import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Bed } from './entities/bed.entity';
import { BedStatus } from '../../common/enums/bed-status.enum';
import { AssignBedDto } from './dto/assign-bed.dto';

/** Lock-namespace prefix for transactional advisory locks. */
const ADVISORY_LOCK_NAMESPACE = 'bed_dept_ward';

@Injectable()
export class BedsService {
  constructor(
    @InjectRepository(Bed)
    private bedsRepository: Repository<Bed>,
  ) {}

  private async acquireBedLock(
    transactionalEntityManager: EntityManager,
    bedId: string,
  ): Promise<void> {
    const dbType = (transactionalEntityManager.connection.options as { type?: string }).type;
    if (dbType !== 'postgres') {
      // Other engines rely on database-level write locks
      return;
    }

    const lockKey = `${ADVISORY_LOCK_NAMESPACE}:bed:${bedId}`;
    const lockResult = await transactionalEntityManager.query(
      `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
      [lockKey],
    );

    const acquired = Array.isArray(lockResult) && lockResult[0]?.acquired === true;
    if (!acquired) {
      throw new ConflictException({
        message: 'Another assignment is currently being processed for this bed. Please retry in a moment.',
        code: 'BED_ASSIGNMENT_LOCK_BUSY',
      });
    }
  }

  async assignBed(bedId: string, assignBedDto: AssignBedDto): Promise<Bed> {
    // Wrap in transaction with advisory locking to prevent concurrent double-booking
    return this.bedsRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // Acquire advisory lock to serialize concurrent assignments for this bed
        await this.acquireBedLock(transactionalEntityManager, bedId);

        // Load bed within transaction with pessimistic lock
        const bed = await transactionalEntityManager
          .createQueryBuilder(Bed, 'bed')
          .useLock('pessimistic_write')
          .where('bed.id = :id', { id: bedId })
          .getOne();

        if (!bed) {
          throw new NotFoundException(`Bed with ID ${bedId} not found`);
        }

        if (bed.status === BedStatus.OCCUPIED) {
          throw new BadRequestException('Bed is already occupied');
        }

        bed.patientId = assignBedDto.patientId;
        bed.status = BedStatus.OCCUPIED;
        bed.assignedAt = new Date();

        return transactionalEntityManager.save(Bed, bed);
      },
    );
  }

  async releaseBed(bedId: string): Promise<Bed> {
    const bed = await this.bedsRepository.findOne({ where: { id: bedId } });

    if (!bed) {
      throw new NotFoundException(`Bed with ID ${bedId} not found`);
    }

    bed.patientId = null;
    bed.status = BedStatus.CLEANING;
    bed.assignedAt = null;

    return this.bedsRepository.save(bed);
  }

  async markBedAvailable(bedId: string): Promise<Bed> {
    const bed = await this.bedsRepository.findOne({ where: { id: bedId } });

    if (!bed) {
      throw new NotFoundException(`Bed with ID ${bedId} not found`);
    }

    bed.status = BedStatus.AVAILABLE;
    return this.bedsRepository.save(bed);
  }

  async getAvailableBeds(roomId?: string): Promise<Bed[]> {
    const query = this.bedsRepository
      .createQueryBuilder('bed')
      .where('bed.status = :status', { status: BedStatus.AVAILABLE })
      .andWhere('bed.isActive = :isActive', { isActive: true });

    if (roomId) {
      query.andWhere('bed.roomId = :roomId', { roomId });
    }

    return query.getMany();
  }

  async getBedAvailabilityByWard(wardId: string): Promise<{
    total: number;
    available: number;
    occupied: number;
    maintenance: number;
    cleaning: number;
    reserved: number;
  }> {
    const beds = await this.bedsRepository
      .createQueryBuilder('bed')
      .innerJoin('bed.room', 'room')
      .where('room.wardId = :wardId', { wardId })
      .andWhere('bed.isActive = :isActive', { isActive: true })
      .getMany();

    return {
      total: beds.length,
      available: beds.filter((b) => b.status === BedStatus.AVAILABLE).length,
      occupied: beds.filter((b) => b.status === BedStatus.OCCUPIED).length,
      maintenance: beds.filter((b) => b.status === BedStatus.MAINTENANCE).length,
      cleaning: beds.filter((b) => b.status === BedStatus.CLEANING).length,
      reserved: beds.filter((b) => b.status === BedStatus.RESERVED).length,
    };
  }
}
