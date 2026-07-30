import { Test, TestingModule } from '@nestjs/testing';
import { TimezoneService } from './timezone.service';

describe('TimezoneService', () => {
  let service: TimezoneService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimezoneService],
    }).compile();
    service = module.get(TimezoneService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('validates a known IANA timezone', () => {
    expect(service.isValid('America/New_York')).toBe(true);
    expect(service.isValid('Africa/Lagos')).toBe(true);
    expect(service.isValid('Europe/London')).toBe(true);
  });

  it('rejects an invalid timezone string', () => {
    expect(service.isValid('Mars/Olympus')).toBe(false);
  });

  it('correctly localises a UTC timestamp to Africa/Lagos (UTC+1)', () => {
    // 2024-06-01T00:00:00Z → should appear as 2024-06-01T01:00:00 in Africa/Lagos
    const utc = new Date('2024-06-01T00:00:00.000Z');
    const localised = service.localise(utc, 'Africa/Lagos');

    // Africa/Lagos is UTC+1 year-round (no DST)
    expect(localised).toContain('2024-06-01');
    expect(localised).toContain('01:00:00');
  });

  it('user-level timezone override takes precedence over hospital timezone', () => {
    const utc = new Date('2024-06-01T12:00:00.000Z');

    const withHospital = service.localise(utc, 'UTC');
    const withUserOverride = service.localise(utc, 'UTC', 'Africa/Lagos');

    // Hospital says UTC → should show 12:00; override says Lagos → should show 13:00
    expect(withHospital).toContain('12:00:00');
    expect(withUserOverride).toContain('13:00:00');
  });

  it('falls back to UTC when no timezone is provided', () => {
    const utc = new Date('2024-01-15T08:30:00.000Z');
    const localised = service.localise(utc);
    expect(localised).toContain('08:30:00');
  });

  it('localises to America/New_York (UTC-5 in winter)', () => {
    // 2024-01-15T10:00:00Z → 2024-01-15T05:00:00 in America/New_York (EST = UTC-5)
    const utc = new Date('2024-01-15T10:00:00.000Z');
    const localised = service.localise(utc, 'America/New_York');

    expect(localised).toContain('2024-01-15');
    expect(localised).toContain('05:00:00');
  });
});
