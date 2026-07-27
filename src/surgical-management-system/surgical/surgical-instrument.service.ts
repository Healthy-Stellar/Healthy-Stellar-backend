import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SurgicalInstrument,
  InstrumentSet,
  InstrumentSetItem,
  SterilisationRecord,
  InstrumentStatus,
} from './entities/surgical-instrument.entity';
import {
  CreateInstrumentDto,
  UpdateInstrumentDto,
  AssignInstrumentSetDto,
  VerifyInstrumentCountDto,
  RecordSterilisationDto,
  InstrumentQueryDto,
} from './dto';

@Injectable()
export class SurgicalInstrumentService {
  private readonly logger = new Logger(SurgicalInstrumentService.name);

  constructor(
    @InjectRepository(SurgicalInstrument)
    private readonly instrumentRepo: Repository<SurgicalInstrument>,
    @InjectRepository(InstrumentSet)
    private readonly setRepo: Repository<InstrumentSet>,
    @InjectRepository(InstrumentSetItem)
    private readonly setItemRepo: Repository<InstrumentSetItem>,
    @InjectRepository(SterilisationRecord)
    private readonly sterilisationRepo: Repository<SterilisationRecord>,
  ) {}

  // ── Instrument CRUD ────────────────────────────────────────────────────────

  async createInstrument(dto: CreateInstrumentDto): Promise<SurgicalInstrument> {
    const instrument = this.instrumentRepo.create(dto);
    return this.instrumentRepo.save(instrument);
  }

  async findInstruments(query: InstrumentQueryDto): Promise<SurgicalInstrument[]> {
    const where: Partial<SurgicalInstrument> = {};
    if (query.status) where.status = query.status;

    const instruments = await this.instrumentRepo.find({ where, order: { name: 'ASC' } });

    // Filter out expired sterile status
    if (query.status === InstrumentStatus.AVAILABLE) {
      const now = new Date();
      return instruments.filter(
        (i) => !i.sterileUntil || i.sterileUntil > now,
      );
    }

    return instruments;
  }

  async findInstrument(id: string): Promise<SurgicalInstrument> {
    const instrument = await this.instrumentRepo.findOne({ where: { id } });
    if (!instrument) throw new NotFoundException(`SurgicalInstrument ${id} not found`);
    return instrument;
  }

  async updateInstrument(id: string, dto: UpdateInstrumentDto): Promise<SurgicalInstrument> {
    const instrument = await this.findInstrument(id);
    Object.assign(instrument, dto);
    return this.instrumentRepo.save(instrument);
  }

  async retireInstrument(id: string): Promise<SurgicalInstrument> {
    const instrument = await this.findInstrument(id);
    instrument.status = InstrumentStatus.RETIRED;
    return this.instrumentRepo.save(instrument);
  }

  // ── Instrument set management ──────────────────────────────────────────────

  async assignInstrumentSet(dto: AssignInstrumentSetDto): Promise<InstrumentSet> {
    const instruments = await Promise.all(
      dto.instrumentIds.map((id) => this.findInstrument(id)),
    );

    const now = new Date();

    for (const instr of instruments) {
      if (instr.status === InstrumentStatus.RETIRED) {
        throw new BadRequestException(`Instrument ${instr.id} (${instr.name}) is retired`);
      }
      if (instr.status !== InstrumentStatus.AVAILABLE) {
        throw new BadRequestException(
          `Instrument ${instr.id} (${instr.name}) is not available (status: ${instr.status})`,
        );
      }
      if (instr.sterileUntil && instr.sterileUntil < now) {
        throw new BadRequestException(
          `Instrument ${instr.id} (${instr.name}) sterilisation expired at ${instr.sterileUntil.toISOString()}`,
        );
      }
    }

    const set = await this.setRepo.save(
      this.setRepo.create({ surgicalCaseId: dto.surgicalCaseId }),
    );

    await this.setItemRepo.save(
      instruments.map((instr) =>
        this.setItemRepo.create({ instrumentSetId: set.id, instrumentId: instr.id }),
      ),
    );

    // Mark instruments as in-use
    await Promise.all(
      instruments.map((instr) => {
        instr.status = InstrumentStatus.IN_USE;
        return this.instrumentRepo.save(instr);
      }),
    );

    this.logger.log(
      `InstrumentSet ${set.id} assigned to case ${dto.surgicalCaseId} — ${instruments.length} instruments`,
    );

    return this.setRepo.findOne({
      where: { id: set.id },
      relations: ['items', 'items.instrument'],
    });
  }

  /**
   * Record the pre-op count for an instrument set.
   * Returns the updated set.
   */
  async recordPreOpCount(dto: VerifyInstrumentCountDto): Promise<InstrumentSet> {
    const set = await this.findSet(dto.instrumentSetId);
    set.preOpCount = dto.count;
    if (dto.nurseId) set.verifiedByNurseId = dto.nurseId;
    return this.setRepo.save(set);
  }

  /**
   * Record the post-op count and check for mismatches.
   * Returns the set with countMismatchAlert=true if counts differ.
   */
  async recordPostOpCount(dto: VerifyInstrumentCountDto): Promise<InstrumentSet> {
    const set = await this.findSet(dto.instrumentSetId);
    set.postOpCount = dto.count;

    if (set.preOpCount === null || set.preOpCount === undefined) {
      throw new BadRequestException('Pre-op count must be recorded before post-op count');
    }

    if (set.preOpCount !== dto.count) {
      set.countMismatchAlert = true;
      set.countVerified = false;
      set.mismatchNotes =
        `COUNT MISMATCH: pre-op=${set.preOpCount}, post-op=${dto.count}. ` +
        `Retained instrument risk — immediate investigation required.`;
      this.logger.warn(
        `[RETAINED INSTRUMENT ALERT] InstrumentSet ${set.id} — case ${set.surgicalCaseId}: ` +
          `pre-op=${set.preOpCount}, post-op=${dto.count}`,
      );
    } else {
      set.countVerified = true;
      set.countMismatchAlert = false;
    }

    if (dto.nurseId) set.verifiedByNurseId = dto.nurseId;
    return this.setRepo.save(set);
  }

  // ── Sterilisation records ──────────────────────────────────────────────────

  async recordSterilisation(dto: RecordSterilisationDto): Promise<SterilisationRecord> {
    const instrument = await this.findInstrument(dto.instrumentId);

    const record = await this.sterilisationRepo.save(
      this.sterilisationRepo.create({
        instrumentId: dto.instrumentId,
        sterilisedAt: dto.sterilisedAt,
        expiresAt: dto.expiresAt,
        performedById: dto.performedById,
        method: dto.method,
        notes: dto.notes,
      }),
    );

    // Update the instrument's sterile-until date and mark it available
    instrument.sterileUntil = dto.expiresAt;
    if (instrument.status === InstrumentStatus.STERILISING) {
      instrument.status = InstrumentStatus.AVAILABLE;
    }
    await this.instrumentRepo.save(instrument);

    return record;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async findSet(id: string): Promise<InstrumentSet> {
    const set = await this.setRepo.findOne({ where: { id } });
    if (!set) throw new NotFoundException(`InstrumentSet ${id} not found`);
    return set;
  }
}
