import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class BedOccupancyService {
  constructor(
    @InjectRepository(Bed) private readonly bedRepo: Repository<Bed>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(Ward) private readonly wardRepo: Repository<Ward>,
  ) {}

  // ── Wards ─────────────────────────────────────────────────────────────────

  async createWard(dto: CreateWardDto): Promise<Ward> {
    return this.wardRepo.save(this.wardRepo.create(dto));
  }

  async getWards(): Promise<Ward[]> {
    return this.wardRepo.find({ where: { isActive: true } });
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  async createRoom(dto: CreateRoomDto): Promise<Room> {
    await this.findWard(dto.wardId);
    return this.roomRepo.save(this.roomRepo.create(dto));
  }

  async getRoomsByWard(wardId: string): Promise<Room[]> {
    return this.roomRepo.find({ where: { wardId, isActive: true } });
  }

  // ── Beds ──────────────────────────────────────────────────────────────────

  async createBed(dto: CreateBedDto): Promise<Bed> {
    await this.findRoom(dto.roomId);
    return this.bedRepo.save(this.bedRepo.create(dto));
  }

  async getBeds(query: BedOccupancyQueryDto): Promise<Bed[]> {
    const where: Partial<Bed> = {};
    if (query.roomId) where.roomId = query.roomId;
    if (query.status) where.status = query.status;
    if (query.activeOnly !== false) where.isActive = true;
    return this.bedRepo.find({ where });
  }

  async getBedById(id: string): Promise<Bed> {
    const bed = await this.bedRepo.findOne({ where: { id } });
    if (!bed) throw new NotFoundException(`Bed ${id} not found`);
    return bed;
  }

  async assignBed(dto: AssignBedDto): Promise<Bed> {
    const bed = await this.getBedById(dto.bedId);
    if (bed.status !== BedStatus.AVAILABLE) {
      throw new BadRequestException(`Bed ${dto.bedId} is not available`);
    }
    bed.patientId = dto.patientId;
    bed.status = BedStatus.OCCUPIED;
    bed.assignedAt = new Date();
    return this.bedRepo.save(bed);
  }

  async releaseBed(bedId: string): Promise<Bed> {
    const bed = await this.getBedById(bedId);
    if (bed.status !== BedStatus.OCCUPIED) {
      throw new BadRequestException(`Bed ${bedId} is not currently occupied`);
    }
    bed.patientId = null;
    bed.status = BedStatus.CLEANING;
    bed.assignedAt = null;
    return this.bedRepo.save(bed);
  }

  async updateBedStatus(bedId: string, dto: UpdateBedStatusDto): Promise<Bed> {
    const bed = await this.getBedById(bedId);
    bed.status = dto.status;
    return this.bedRepo.save(bed);
  }

  async getOccupancySummary(wardId?: string): Promise<Record<BedStatus, number> & { total: number }> {
    const qb = this.bedRepo.createQueryBuilder('bed')
      .select('bed.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('bed.isActive = true');

    if (wardId) {
      qb.innerJoin(Room, 'room', 'room.id = bed.roomId AND room.wardId = :wardId', { wardId });
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

  private async findWard(id: string): Promise<Ward> {
    const ward = await this.wardRepo.findOne({ where: { id } });
    if (!ward) throw new NotFoundException(`Ward ${id} not found`);
    return ward;
  }

  private async findRoom(id: string): Promise<Room> {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }
}
