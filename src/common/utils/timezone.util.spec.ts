import {
  getWibDate,
  getWibTimeParts,
  parseTimeString,
} from './timezone.util';

describe('timezone.util', () => {
  describe('getWibDate()', () => {
    it('returns normalized UTC midnight date for Asia/Jakarta calendar date when time is early morning WIB (prior-day UTC)', () => {
      // 06:30:00 WIB on 2026-09-04 = 23:30:00 UTC on 2026-09-03
      const earlyMorningWib = new Date('2026-09-03T23:30:00.000Z');
      const wibDate = getWibDate(earlyMorningWib);

      expect(wibDate.toISOString()).toBe('2026-09-04T00:00:00.000Z');
      expect(wibDate.getUTCFullYear()).toBe(2026);
      expect(wibDate.getUTCMonth()).toBe(8); // September (0-indexed)
      expect(wibDate.getUTCDate()).toBe(4);
      expect(wibDate.getUTCHours()).toBe(0);
      expect(wibDate.getUTCMinutes()).toBe(0);
    });

    it('returns same normalized UTC midnight date for afternoon WIB on the same calendar day', () => {
      // 17:00:00 WIB on 2026-09-04 = 10:00:00 UTC on 2026-09-04
      const afternoonWib = new Date('2026-09-04T10:00:00.000Z');
      const wibDate = getWibDate(afternoonWib);

      expect(wibDate.toISOString()).toBe('2026-09-04T00:00:00.000Z');
    });

    it('early morning and afternoon WIB produce identical normalized date objects', () => {
      const earlyMorning = new Date('2026-09-03T23:30:00.000Z'); // 06:30 WIB Sep 4
      const afternoon = new Date('2026-09-04T10:00:00.000Z'); // 17:00 WIB Sep 4

      expect(getWibDate(earlyMorning).getTime()).toBe(getWibDate(afternoon).getTime());
    });

    it('handles month-end boundary correctly (e.g., Aug 31 23:30 UTC = Sep 1 06:30 WIB)', () => {
      const monthEnd = new Date('2026-08-31T23:30:00.000Z');
      const wibDate = getWibDate(monthEnd);

      expect(wibDate.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });

    it('handles year-end boundary correctly (e.g., Dec 31 23:30 UTC = Jan 1 06:30 WIB)', () => {
      const yearEnd = new Date('2026-12-31T23:30:00.000Z');
      const wibDate = getWibDate(yearEnd);

      expect(wibDate.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  describe('getWibTimeParts()', () => {
    it('correctly calculates hours and minutes in Asia/Jakarta', () => {
      const date = new Date('2026-09-03T23:30:00.000Z'); // 06:30 WIB
      const parts = getWibTimeParts(date);

      expect(parts.hour).toBe(6);
      expect(parts.minute).toBe(30);
      expect(parts.totalMinutes).toBe(390);
    });
  });

  describe('parseTimeString()', () => {
    it('correctly parses HH:mm string', () => {
      const parts = parseTimeString('09:15');

      expect(parts.hour).toBe(9);
      expect(parts.minute).toBe(15);
      expect(parts.totalMinutes).toBe(555);
    });
  });
});
