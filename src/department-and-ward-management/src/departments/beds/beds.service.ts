import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bed } from './entities/bed.entity';
import { BedStatus } from '../../common/enums/bed-status.enum';
import { AssignBedDto } from './dto/assign-bed.dto';

@Injectable()
export class BedsService {
  constructor(
    @InjectRepository(Bed)
    private bedsRepository: Repository<Bed>,
  ) {}

  async assignBed(bedId: string, assignBedDto: AssignBedDto): Promise<Bed> {
    const bed = await this.bedsRepository.findOne({ where: { id: bedId } });

    if (!bed) {
      throw new NotFoundException(`Bed with ID ${bedId} not found`);
    }

    if (bed.status === BedStatus.OCCUPIED) {
      throw new BadRequestException('Bed is already occupied');
    }

    bed.patientId = assignBedDto.patientId;
    bed.status = BedStatus.OCCUPIED;
    bed.assignedAt = new Date();

    return this.bedsRepository.save(bed);
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
