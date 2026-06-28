import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Hl7v2LabImportService } from './hl7v2-lab-import.service';
import { Hl7v2OruParser } from '../parsers/hl7v2-oru.parser';
import { LabResult } from '../../laboratory/entities/lab-result.entity';

const SAMPLE_ORU_R01 = [
  'MSH|^~\\&|LIS|GeneralHospital|EHR|GeneralHospital|20240115143000||ORU^R01|MSG00001|P|2.5.1',
  'PID|1||PATID12345^^^GeneralHospital^MR||DOE^JOHN^A||19800101|M',
  'OBR|1|ORD12345|FIL67890|24323-8^Comprehensive metabolic panel^LN|||20240115140000|||||||||1234^SMITH^JANE',
  'OBX|1|NM|2823-3^Potassium^LN||4.2|mEq/L|3.5-5.0|N|||F|||20240115141500',
  'OBX|2|NM|99999-9^Unmapped Analyte^LN||1.0|unit|0-2|N|||F|||20240115141500',
].join('\r');

describe('Hl7v2LabImportService', () => {
  let service: Hl7v2LabImportService;
  let labResultRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    labResultRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: `id-${data.testCode}`, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Hl7v2LabImportService,
        Hl7v2OruParser,
        { provide: getRepositoryToken(LabResult), useValue: labResultRepo },
      ],
    }).compile();

    service = module.get(Hl7v2LabImportService);
  });

  it('maps a known LOINC code to its internal test code', async () => {
    const { created } = await service.importRaw(SAMPLE_ORU_R01);

    const potassium = created.find((r) => r.testId === '2823-3');
    expect(potassium).toMatchObject({
      testCode: 'POTASSIUM',
      orderId: 'FIL67890',
      result: '4.2',
      unit: 'mEq/L',
      flag: 'normal',
      status: 'final',
      performedBy: '1234',
    });
  });

  it('falls back to the raw LOINC code when there is no internal mapping', async () => {
    const { created } = await service.importRaw(SAMPLE_ORU_R01);
    const unmapped = created.find((r) => r.testId === '99999-9');
    expect(unmapped?.testCode).toBe('99999-9');
  });

  it('persists one LabResult row per OBX segment', async () => {
    const { created } = await service.importRaw(SAMPLE_ORU_R01);
    expect(created).toHaveLength(2);
    expect(labResultRepo.save).toHaveBeenCalledTimes(2);
  });

  it('flags an abnormal result as "abnormal"', async () => {
    const highGlucose = SAMPLE_ORU_R01.replace(
      'OBX|1|NM|2823-3^Potassium^LN||4.2|mEq/L|3.5-5.0|N|||F|||20240115141500',
      'OBX|1|NM|2339-0^Glucose^LN||220|mg/dL|70-100|H|||F|||20240115141500',
    );
    const { created } = await service.importRaw(highGlucose);
    const glucose = created.find((r) => r.testId === '2339-0');
    expect(glucose?.flag).toBe('abnormal');
  });

  it('propagates parser validation errors (e.g. missing OBR)', async () => {
    const noObr = SAMPLE_ORU_R01.split('\r').filter((s) => !s.startsWith('OBR|')).join('\r');
    await expect(service.importRaw(noObr)).rejects.toThrow('Missing required OBR segment');
  });
});
