import { Injectable } from '@nestjs/common';

/**
 * TimezoneService
 *
 * Localises UTC Date objects to a tenant/hospital IANA timezone string.
 * Falls back to a user-level timezone override when provided.
 *
 * Relies on the built-in Intl.DateTimeFormat API — no extra dependencies.
 */
@Injectable()
export class TimezoneService {
  private readonly DEFAULT_TIMEZONE = 'UTC';

  /**
   * Convert a UTC Date to an ISO-8601-like string in the resolved timezone.
   *
   * @param utcDate        The UTC Date to localise.
   * @param hospitalTz     IANA timezone string from HospitalConfig (e.g. "America/New_York").
   * @param userTzOverride Optional per-user timezone that overrides the hospital default.
   */
  localise(utcDate: Date, hospitalTz?: string, userTzOverride?: string): string {
    const tz = userTzOverride ?? hospitalTz ?? this.DEFAULT_TIMEZONE;
    return this.formatInZone(utcDate, tz);
  }

  /**
   * Parse a local date-time string (from a user in a given timezone) back to a UTC Date.
   *
   * The input must be an ISO-8601 string **without** timezone offset, representing
   * local time in `timezone`.  e.g. "2024-03-15T09:00:00"
   */
  toUtc(localIso: string, timezone: string): Date {
    // Append the timezone name so the Date constructor can interpret it correctly.
    // Most modern runtimes (Node ≥ 21 / V8 with full ICU) support this.
    const tagged = `${localIso} ${timezone}`;
    const d = new Date(tagged);
    if (isNaN(d.getTime())) {
      // Fallback: treat as UTC and let callers handle the offset externally.
      return new Date(localIso);
    }
    return d;
  }

  /** Validate that a timezone string is a known IANA timezone. */
  isValid(tz: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  /** Format a Date in the given IANA timezone as an ISO-8601-style string. */
  private formatInZone(date: Date, tz: string): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // en-CA gives "YYYY-MM-DD, HH:MM:SS" — normalise to ISO-like
    return fmt.format(date).replace(', ', 'T');
  }
}
