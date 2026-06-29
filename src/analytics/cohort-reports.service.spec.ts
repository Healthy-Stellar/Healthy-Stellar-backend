import { Test, TestingModule } from '@nestjs/testing';
import { CohortReportsService } from './cohort-reports.service';
import { ReadReplicaService } from '../database/read-replica.service';
import { ReportQueryDto } from './dto/report-query.dto';

describe('CohortReportsService', () => {
  let service: CohortReportsService;
  let readReplicaService: { getDataSource: jest.Mock };
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    readReplicaService = { getDataSource: jest.fn().mockReturnValue(dataSource) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CohortReportsService,
        { provide: ReadReplicaService, useValue: readReplicaService },
      ],
    }).compile();

    service = module.get(CohortReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getReadmissionRateReport', () => {
    it('computes readmission rate percent per ICD-10 category', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { icd10Category: 'Endocrine', indexEpisodeCount: '10', readmissionCount: '2' },
          { icd10Category: 'Cardio', indexEpisodeCount: '5', readmissionCount: '0' },
        ])
        .mockResolvedValueOnce([{ total: '2' }]);

      const result = await service.getReadmissionRateReport({} as ReportQueryDto);

      expect(result.total).toBe(2);
      expect(result.rows).toEqual([
        { icd10Category: 'Endocrine', indexEpisodeCount: 10, readmissionCount: 2, readmissionRatePercent: 20 },
        { icd10Category: 'Cardio', indexEpisodeCount: 5, readmissionCount: 0, readmissionRatePercent: 0 },
      ]);
    });

    it('queries with positional params converted from named placeholders', async () => {
      dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);

      await service.getReadmissionRateReport({ from: '2024-01-01', to: '2024-02-01', page: 2, limit: 10 } as ReportQueryDto);

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).not.toContain(':windowDays');
      expect(sql).toContain('$1');
      expect(params).toEqual(expect.arrayContaining([30, '2024-01-01', '2024-02-01', 10, 10]));
    });

    it('returns 0% rate when there are no index episodes', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ icd10Category: 'Other', indexEpisodeCount: '0', readmissionCount: '0' }])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.getReadmissionRateReport({} as ReportQueryDto);
      expect(result.rows[0].readmissionRatePercent).toBe(0);
    });
  });

  describe('getLengthOfStayReport', () => {
    it('returns average length of stay per ward per month', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            wardId: 'ward-1',
            wardName: 'ICU',
            month: '2024-01',
            stayCount: '4',
            avgLengthOfStayDays: '5.5',
          },
        ])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.getLengthOfStayReport({} as ReportQueryDto);

      expect(result.total).toBe(1);
      expect(result.rows).toEqual([
        {
          wardId: 'ward-1',
          wardName: 'ICU',
          month: '2024-01',
          stayCount: 4,
          averageLengthOfStayDays: 5.5,
        },
      ]);
    });

    it('defaults averageLengthOfStayDays to 0 when null', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { wardId: 'ward-2', wardName: 'ER', month: '2024-03', stayCount: '1', avgLengthOfStayDays: null },
        ])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.getLengthOfStayReport({} as ReportQueryDto);
      expect(result.rows[0].averageLengthOfStayDays).toBe(0);
    });
  });
});
