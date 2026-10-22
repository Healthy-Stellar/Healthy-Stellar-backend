import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { MedicalDataSanitizerService } from './medical-data-sanitizer.service';
import { MedicalDataValidationPipe } from './medical-data.validator.pipe';

describe('MedicalDataValidationPipe', () => {
  let pipe: MedicalDataValidationPipe;
  const sanitizer = new MedicalDataSanitizerService();

  beforeEach(() => {
    pipe = new MedicalDataValidationPipe(sanitizer);
  });

  it('returns 1 for missing page query values', async () => {
    const metadata: ArgumentMetadata = {
      type: 'query',
      metatype: Number,
      data: 'page',
    };

    expect(await pipe.transform(undefined, metadata)).toBe(1);
  });

  it('returns 20 for missing pageSize query values', async () => {
    const metadata: ArgumentMetadata = {
      type: 'query',
      metatype: Number,
      data: 'pageSize',
    };

    expect(await pipe.transform(undefined, metadata)).toBe(20);
  });

  it('returns 0 for missing offset query values', async () => {
    const metadata: ArgumentMetadata = {
      type: 'query',
      metatype: Number,
      data: 'offset',
    };

    expect(await pipe.transform(undefined, metadata)).toBe(0);
  });

  it('parses numeric query string values', async () => {
    const metadata: ArgumentMetadata = {
      type: 'query',
      metatype: Number,
      data: 'page',
    };

    expect(await pipe.transform('3', metadata)).toBe(3);
  });

  it('sanitizes non-query primitive values without DTO validation', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: String,
      data: 'name',
    };

    expect(await pipe.transform(' <script>alert(1)</script> name ', metadata)).toBe('alert(1) name');
  });

  it('throws when no data is provided for DTO validation', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: class TestDto {},
      data: 'test',
    };

    await expect(pipe.transform(null, metadata)).rejects.toThrow(BadRequestException);
  });
});
