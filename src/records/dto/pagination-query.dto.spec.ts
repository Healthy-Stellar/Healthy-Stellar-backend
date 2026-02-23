import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { PaginationQueryDto, SortBy, SortOrder } from './pagination-query.dto';
import { RecordType } from './create-record.dto';

describe('PaginationQueryDto', () => {
  describe('page validation', () => {
    it('should accept valid page number', async () => {
      const dto = plainToClass(PaginationQueryDto, { page: '1' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject page less than 1', async () => {
      const dto = plainToClass(PaginationQueryDto, { page: '0' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should reject negative page', async () => {
      const dto = plainToClass(PaginationQueryDto, { page: '-1' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should reject non-integer page', async () => {
      const dto = plainToClass(PaginationQueryDto, { page: '1.5' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should use default page value when not provided', () => {
      const dto = plainToClass(PaginationQueryDto, {});
      expect(dto.page).toBe(1);
    });
  });

  describe('limit validation', () => {
    it('should accept valid limit', async () => {
      const dto = plainToClass(PaginationQueryDto, { limit: '20' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject limit less than 1', async () => {
      const dto = plainToClass(PaginationQueryDto, { limit: '0' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('should reject limit greater than 100', async () => {
      const dto = plainToClass(PaginationQueryDto, { limit: '101' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('should accept limit of exactly 100', async () => {
      const dto = plainToClass(PaginationQueryDto, { limit: '100' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should use default limit value when not provided', () => {
      const dto = plainToClass(PaginationQueryDto, {});
      expect(dto.limit).toBe(20);
    });
  });

  describe('recordType validation', () => {
    it('should accept valid recordType', async () => {
      const dto = plainToClass(PaginationQueryDto, {
        recordType: RecordType.MEDICAL_REPORT,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept all valid recordType values', async () => {
      const recordTypes = [
        RecordType.MEDICAL_REPORT,
        RecordType.LAB_RESULT,
        RecordType.PRESCRIPTION,
        RecordType.IMAGING,
        RecordType.CONSULTATION,
      ];

      for (const recordType of recordTypes) {
        const dto = plainToClass(PaginationQueryDto, { recordType });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should reject invalid recordType', async () => {
      const dto = plainToClass(PaginationQueryDto, { recordType: 'INVALID_TYPE' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('recordType');
    });

    it('should allow recordType to be optional', async () => {
      const dto = plainToClass(PaginationQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('date validation', () => {
    it('should accept valid ISO 8601 fromDate', async () => {
      const dto = plainToClass(PaginationQueryDto, {
        fromDate: '2024-01-01T00:00:00Z',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid ISO 8601 toDate', async () => {
      const dto = plainToClass(PaginationQueryDto, {
        toDate: '2024-12-31T23:59:59Z',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid date format', async () => {
      const dto = plainToClass(PaginationQueryDto, { fromDate: '2024-01-01' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('fromDate');
    });

    it('should allow dates to be optional', async () => {
      const dto = plainToClass(PaginationQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('sortBy validation', () => {
    it('should accept valid sortBy values', async () => {
      const sortByValues = [SortBy.CREATED_AT, SortBy.RECORD_TYPE, SortBy.PATIENT_ID];

      for (const sortBy of sortByValues) {
        const dto = plainToClass(PaginationQueryDto, { sortBy });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should reject invalid sortBy value', async () => {
      const dto = plainToClass(PaginationQueryDto, { sortBy: 'invalidField' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sortBy');
    });

    it('should use default sortBy value when not provided', () => {
      const dto = plainToClass(PaginationQueryDto, {});
      expect(dto.sortBy).toBe(SortBy.CREATED_AT);
    });
  });

  describe('order validation', () => {
    it('should accept asc order', async () => {
      const dto = plainToClass(PaginationQueryDto, { order: SortOrder.ASC });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept desc order', async () => {
      const dto = plainToClass(PaginationQueryDto, { order: SortOrder.DESC });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid order value', async () => {
      const dto = plainToClass(PaginationQueryDto, { order: 'invalid' as any });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('order');
    });

    it('should use default order value when not provided', () => {
      const dto = plainToClass(PaginationQueryDto, {});
      expect(dto.order).toBe(SortOrder.DESC);
    });
  });

  describe('patientId validation', () => {
    it('should accept valid patientId', async () => {
      const dto = plainToClass(PaginationQueryDto, {
        patientId: '123e4567-e89b-12d3-a456-426614174000',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow patientId to be optional', async () => {
      const dto = plainToClass(PaginationQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('combined validation', () => {
    it('should accept all valid parameters together', async () => {
      const dto = plainToClass(PaginationQueryDto, {
        page: '2',
        limit: '50',
        recordType: RecordType.LAB_RESULT,
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
        sortBy: SortBy.CREATED_AT,
        order: SortOrder.ASC,
        patientId: 'patient-123',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate multiple invalid parameters', async () => {
      const dto = plainToClass(PaginationQueryDto, {
        page: '0',
        limit: '101',
        recordType: 'INVALID',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
