import { Test, TestingModule } from '@nestjs/testing';
import { CohortQueryService } from './cohort-query.service';
import { ReadReplicaService } from '../database/read-replica.service';
import { CohortQueryDto } from './dto/cohort-query.dto';

function makeQueryBuilder(rawMany: any[] = [], rawOne: any = null, count = 0) {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
    getRawMany: jest.fn().mockResolvedValue(rawMany),
    getRawOne: jest.fn().mockResolvedValue(rawOne),
  };
  return qb;
}

describe('CohortQueryService', () => {
  let service: CohortQueryService;
  let readReplicaService: { getDataSource: jest.Mock };
  let dataSource: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    dataSource = { createQueryBuilder: jest.fn() };
    readReplicaService = { getDataSource: jest.fn().mockReturnValue(dataSource) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CohortQueryService,
        { provide: ReadReplicaService, useValue: readReplicaService },
      ],
    }).compile();

    service = module.get(CohortQueryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('buildQuery', () => {
    it('applies diagnosisCodes filter as an IN subquery', () => {
      const qb = makeQueryBuilder();
      dataSource.createQueryBuilder.mockReturnValue(qb);

      service.buildQuery({ diagnosisCodes: ['E11.9', 'I10'] } as CohortQueryDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('SELECT d."patientId" FROM diagnoses'),
        { diagnosisCodes: ['E11.9', 'I10'] },
      );
    });

    it('applies admission date range filters', () => {
      const qb = makeQueryBuilder();
      dataSource.createQueryBuilder.mockReturnValue(qb);

      service.buildQuery({
        admissionDateFrom: '2024-01-01',
        admissionDateTo: '2024-02-01',
      } as CohortQueryDto);

      expect(qb.andWhere).toHaveBeenCalledWith('patient."admissionDate" >= :admissionDateFrom', {
        admissionDateFrom: '2024-01-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('patient."admissionDate" <= :admissionDateTo', {
        admissionDateTo: '2024-02-01',
      });
    });

    it('applies age range filters derived from date of birth', () => {
      const qb = makeQueryBuilder();
      dataSource.createQueryBuilder.mockReturnValue(qb);

      service.buildQuery({ minAge: 18, maxAge: 65 } as CohortQueryDto);

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('dateOfBirth" <='), {
        minAge: 18,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('dateOfBirth" >'), {
        maxAgeExclusive: 66,
      });
    });

    it('applies ward filter', () => {
      const qb = makeQueryBuilder();
      dataSource.createQueryBuilder.mockReturnValue(qb);

      service.buildQuery({ wardIds: ['ward-1', 'ward-2'] } as CohortQueryDto);

      expect(qb.andWhere).toHaveBeenCalledWith('room."wardId" IN (:...wardIds)', {
        wardIds: ['ward-1', 'ward-2'],
      });
    });

    it('does not apply optional filters when omitted', () => {
      const qb = makeQueryBuilder();
      dataSource.createQueryBuilder.mockReturnValue(qb);

      service.buildQuery({} as CohortQueryDto);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('returns paginated patient rows with computed age and length of stay', async () => {
      const rawRow = {
        patientId: 'p1',
        dateOfBirth: new Date(new Date().getFullYear() - 30, 0, 1).toISOString().split('T')[0],
        admissionDate: '2024-01-01',
        dischargeDate: '2024-01-11',
        isAdmitted: false,
        wardId: 'ward-1',
      };
      const listQb = makeQueryBuilder([rawRow], null, 1);
      const statsQb = makeQueryBuilder(
        [],
        {
          count: '1',
          avgLengthOfStayDays: '10',
          avgAgeYears: '30',
          currentlyAdmittedCount: '0',
        },
        1,
      );
      dataSource.createQueryBuilder
        .mockReturnValueOnce(listQb)
        .mockReturnValueOnce(statsQb);

      const result = await service.run({ page: 1, limit: 20 } as CohortQueryDto);

      expect(result.total).toBe(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].patientId).toBe('p1');
      expect(result.rows[0].lengthOfStayDays).toBe(10);
      expect(result.rows[0].ageYears).toBe(30);
      expect(result.statistics).toEqual({
        count: 1,
        averageLengthOfStayDays: 10,
        averageAgeYears: 30,
        currentlyAdmittedCount: 0,
      });
    });

    it('handles an empty cohort gracefully', async () => {
      const listQb = makeQueryBuilder([], null, 0);
      const statsQb = makeQueryBuilder([], { count: '0' }, 0);
      dataSource.createQueryBuilder
        .mockReturnValueOnce(listQb)
        .mockReturnValueOnce(statsQb);

      const result = await service.run({} as CohortQueryDto);

      expect(result.total).toBe(0);
      expect(result.rows).toEqual([]);
      expect(result.statistics.count).toBe(0);
      expect(result.statistics.averageLengthOfStayDays).toBeNull();
    });
  });
});
