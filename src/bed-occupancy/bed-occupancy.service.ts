import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { Bed } from './entities/bed.entity';
import { Room } from './entities/room.entity';
import { Ward } from './entities/ward.entity';
import { BedStatus } from './bed-status.enum';
import {
  AssignBedDto,
  BedOccupancyQueryDto,
  CreateBedDto,
  CreateRoomDto,
  CreateWardDto,
  UpdateBedStatusDto,
} from './dto/bed-occupancy.dto';

/** Lock-namespace prefix for transactional advisory locks. */
const ADVISORY_LOCK_NAMESPACE = 'bed_occupancy';

export const ALLOWED_BED_STATUS_TRANSITIONS: Record<BedStatus, BedStatus[]> = {
  [BedStatus.AVAILABLE]: [BedStatus.MAINTENANCE, BedStatus.CLEANING, BedStatus.RESERVED],
  [BedStatus.CLEANING]: [BedStatus.AVAILABLE, BedStatus.MAINTENANCE],
  [BedStatus.MAINTENANCE]: [BedStatus.AVAILABLE, BedStatus.CLEANING],
  [BedStatus.RESERVED]: [BedStatus.AVAILABLE, BedStatus.MAINTENANCE, BedStatus.CLEANING],
  [BedStatus.OCCUPIED]: [],
};

@Injectable()
export class BedOccupancyService {
  constructor(
    @InjectRepository(Bed) private readonly bedRepo: Repository<Bed>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(Ward) private readonly wardRepo: Repository<Ward>,
  ) {}

  // ── Wards ─────────────────────────────────────────────────────────────────

  async createWard(dto: CreateWardDto, tenantId: string): Promise<Ward> {
    this.requireTenantId(tenantId);
    return this.wardRepo.save(this.wardRepo.create({ ...dto, tenantId }));
  }

  async getWards(tenantId: string): Promise<Ward[]> {
    this.requireTenantId(tenantId);
    return this.wardRepo.find({ where: { tenantId, isActive: true } });
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  async createRoom(dto: CreateRoomDto, tenantId: string): Promise<Room> {
    this.requireTenantId(tenantId);
    await this.findWard(dto.wardId, tenantId);
    return this.roomRepo.save(this.roomRepo.create({ ...dto, tenantId }));
  }

  async getRoomsByWard(wardId: string, tenantId: string): Promise<Room[]> {
    this.requireTenantId(tenantId);
    await this.findWard(wardId, tenantId);
    return this.roomRepo.find({ where: { wardId, tenantId, isActive: true } });
  }

  // ── Beds ──────────────────────────────────────────────────────────────────

  async createBed(dto: CreateBedDto, tenantId: string): Promise<Bed> {
    this.requireTenantId(tenantId);
    const room = await this.findRoom(dto.roomId, tenantId);
    await this.findWard(room.wardId, tenantId);
    return this.bedRepo.save(this.bedRepo.create({ ...dto, tenantId }));
  }

  async getBeds(query: BedOccupancyQueryDto, tenantId: string): Promise<Bed[]> {
    this.requireTenantId(tenantId);
    const where: FindOptionsWhere<Bed> = { tenantId };

    if (query.wardId) {
      await this.findWard(query.wardId, tenantId);
    }

    if (query.roomId) {
      const room = await this.findRoom(query.roomId, tenantId);
      if (query.wardId && room.wardId !== query.wardId) {
        return [];
      }
      where.roomId = query.roomId;
    } else if (query.wardId) {
      const wardRooms = await this.roomRepo.find({
        where: { wardId: query.wardId, tenantId },
      });
      if (wardRooms.length === 0) {
        return [];
      }
      where.roomId = In(wardRooms.map((r) => r.id));
    }

    if (query.status) where.status = query.status;
    if (query.activeOnly !== false) where.isActive = true;
    return this.bedRepo.find({ where });
  }

  async getBedById(id: string, tenantId: string): Promise<Bed> {
    this.requireTenantId(tenantId);
    const bed = await this.bedRepo.findOne({ where: { id, tenantId } });
    if (!bed) throw new NotFoundException(`Bed ${id} not found`);
    return bed;
  }

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
    const lockResult = (await transactionalEntityManager.query(
      `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
      [lockKey],
    )) as Array<{ acquired?: boolean }>;

    const acquired = Array.isArray(lockResult) && lockResult[0]?.acquired === true;
    if (!acquired) {
      throw new ConflictException({
        message:
          'Another assignment is currently being processed for this bed. Please retry in a moment.',
        code: 'BED_ASSIGNMENT_LOCK_BUSY',
      });
    }
  }

  private async acquirePatientLock(
    transactionalEntityManager: EntityManager,
    patientId: string,
  ): Promise<void> {
    const dbType = (transactionalEntityManager.connection.options as { type?: string }).type;
    if (dbType !== 'postgres') {
      // Other engines rely on database-level write locks
      return;
    }

    const lockKey = `${ADVISORY_LOCK_NAMESPACE}:patient:${patientId}`;
    const lockResult = await transactionalEntityManager.query(
      `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
      [lockKey],
    );

    const acquired = Array.isArray(lockResult) && lockResult[0]?.acquired === true;
    if (!acquired) {
      throw new ConflictException({
        message: 'Another assignment is currently being processed for this patient. Please retry in a moment.',
        code: 'PATIENT_ASSIGNMENT_LOCK_BUSY',
      });
    }
  }

  async assignBed(dto: AssignBedDto, tenantId: string): Promise<Bed> {
    this.requireTenantId(tenantId);
    // Wrap in transaction with advisory locking to prevent concurrent double-booking
    return this.bedRepo.manager.transaction(
      async (transactionalEntityManager: EntityManager): Promise<Bed> => {
        // Acquire advisory lock to serialize concurrent assignments for this bed
        await this.acquireBedLock(transactionalEntityManager, dto.bedId);
        // Acquire advisory lock to serialize concurrent assignments for this patient
        await this.acquirePatientLock(transactionalEntityManager, dto.patientId);

        // Load bed within transaction with pessimistic lock, scoped to caller tenant
        const bed: Bed | null = await transactionalEntityManager
          .createQueryBuilder(Bed, 'bed')
          .setLock('pessimistic_write')
          .where('bed.id = :id', { id: dto.bedId })
          .andWhere('bed.tenantId = :tenantId', { tenantId })
          .getOne();

        if (!bed) {
          throw new NotFoundException(`Bed ${dto.bedId} not found`);
        }

        if (bed.status !== BedStatus.AVAILABLE) {
          throw new BadRequestException(`Bed ${dto.bedId} is not available`);
        }

        // Reject if the patient already occupies another bed in the same tenant
        const existingBed = await transactionalEntityManager
          .createQueryBuilder(Bed, 'bed')
          .setLock('pessimistic_write')
          .where('bed.patientId = :patientId', { patientId: dto.patientId })
          .andWhere('bed.tenantId = :tenantId', { tenantId })
          .andWhere('bed.status = :status', { status: BedStatus.OCCUPIED })
          .andWhere('bed.id != :bedId', { bedId: dto.bedId })
          .getOne();

        if (existingBed) {
          throw new ConflictException({
            message: `Patient ${dto.patientId} is already assigned to bed ${existingBed.id}. Release that bed before assigning a new one.`,
            code: 'PATIENT_ALREADY_ASSIGNED',
          });
        }

        bed.patientId = dto.patientId;
        bed.status = BedStatus.OCCUPIED;
        bed.assignedAt = new Date();

        return transactionalEntityManager.save(Bed, bed);
      },
    );
  }

  async releaseBed(bedId: string, tenantId: string): Promise<Bed> {
    this.requireTenantId(tenantId);
    const bed = await this.getBedById(bedId, tenantId);
    if (bed.status !== BedStatus.OCCUPIED) {
      throw new BadRequestException(`Bed ${bedId} is not currently occupied`);
    }
    bed.patientId = null;
    bed.status = BedStatus.CLEANING;
    bed.assignedAt = null;
    return this.bedRepo.save(bed);
  }

  async updateBedStatus(
    bedId: string,
    dto: UpdateBedStatusDto,
    tenantId: string,
  ): Promise<Bed> {
    this.requireTenantId(tenantId);
    return this.bedRepo.manager.transaction(
      async (transactionalEntityManager: EntityManager): Promise<Bed> => {
        await this.acquireBedLock(transactionalEntityManager, bedId);

        const bed: Bed | null = await transactionalEntityManager
          .createQueryBuilder(Bed, 'bed')
          .setLock('pessimistic_write')
          .where('bed.id = :id', { id: bedId })
          .andWhere('bed.tenantId = :tenantId', { tenantId })
          .getOne();

        if (!bed) {
          throw new NotFoundException(`Bed ${bedId} not found`);
        }

        if (dto.status === BedStatus.OCCUPIED) {
          throw new BadRequestException(
            'Cannot transition to OCCUPIED status via updateBedStatus; use assignBed instead',
          );
        }

        if (bed.status === BedStatus.OCCUPIED || bed.patientId) {
          throw new BadRequestException(
            `Bed ${bedId} is currently occupied and must be released via releaseBed`,
          );
        }

        const allowedTransitions = ALLOWED_BED_STATUS_TRANSITIONS[bed.status] || [];
        if (!allowedTransitions.includes(dto.status)) {
          throw new BadRequestException(
            `Invalid bed status transition from ${bed.status} to ${dto.status}`,
          );
        }

        bed.status = dto.status;
        return transactionalEntityManager.save(Bed, bed);
      },
    );
  }

  async getOccupancySummary(
    tenantId: string,
    wardId?: string,
  ): Promise<Record<BedStatus, number> & { total: number }> {
    this.requireTenantId(tenantId);
    if (wardId) {
      await this.findWard(wardId, tenantId);
    }

    const qb = this.bedRepo
      .createQueryBuilder('bed')
      .select('bed.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('bed.isActive = true')
      .andWhere('bed.tenantId = :tenantId', { tenantId });

    if (wardId) {
      qb.innerJoin(
        Room,
        'room',
        'room.id = bed.roomId AND room.wardId = :wardId AND room.tenantId = :tenantId',
        { wardId, tenantId },
      );
    }

    const rows: Array<{ status: BedStatus; count: string }> = await qb
      .groupBy('bed.status')
      .getRawMany();

    const summary: Record<string, number> = { total: 0 };
    for (const { status, count } of rows) {
      summary[status] = Number(count);
      summary['total'] += Number(count);
    }
    return summary as Record<BedStatus, number> & { total: number };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private requireTenantId(tenantId: string): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return tenantId;
  }

  private async findWard(id: string, tenantId: string): Promise<Ward> {
    const ward = await this.wardRepo.findOne({ where: { id, tenantId } });
    if (!ward) throw new NotFoundException(`Ward ${id} not found`);
    return ward;
  }

  private async findRoom(id: string, tenantId: string): Promise<Room> {
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }
}
