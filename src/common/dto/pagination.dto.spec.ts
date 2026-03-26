import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('should use default values when not provided', () => {
    const dto = plainToInstance(PaginationDto, {});
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('should accept valid page and pageSize', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 2,
      pageSize: 50,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(50);
  });

  it('should transform string to number', () => {
    const dto = plainToInstance(PaginationDto, {
      page: '3',
      pageSize: '25',
    });

    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(25);
  });

  it('should fail validation for page less than 1', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 0,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('page');
  });

  it('should fail validation for negative page', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: -1,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('page');
  });

  it('should fail validation for pageSize less than 1', async () => {
    const dto = plainToInstance(PaginationDto, {
      pageSize: 0,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('pageSize');
  });

  it('should fail validation for pageSize greater than 100', async () => {
    const dto = plainToInstance(PaginationDto, {
      pageSize: 101,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('pageSize');
  });

  it('should accept pageSize of exactly 100', async () => {
    const dto = plainToInstance(PaginationDto, {
      pageSize: 100,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.pageSize).toBe(100);
  });

  it('should fail validation for non-integer page', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: 1.5,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('page');
  });

  it('should fail validation for non-integer pageSize', async () => {
    const dto = plainToInstance(PaginationDto, {
      pageSize: 20.7,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('pageSize');
  });
});
