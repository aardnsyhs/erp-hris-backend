/**
 * Utility for timezone conversion to Asia/Jakarta (WIB, UTC+7).
 * Ensures server-independent time extraction for HRIS attendance classification.
 */
export function getWibTimeParts(date: Date): {
  hour: number;
  minute: number;
  totalMinutes: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(
    parts.find((p) => p.type === 'hour')?.value ?? '0',
    10,
  );
  const minute = parseInt(
    parts.find((p) => p.type === 'minute')?.value ?? '0',
    10,
  );

  return {
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

/**
 * Parses "HH:mm" time string into hour and minute components.
 */
export function parseTimeString(timeStr: string): {
  hour: number;
  minute: number;
  totalMinutes: number;
} {
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  return {
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

/**
 * Returns a normalized UTC Date (midnight 00:00:00.000Z) representing
 * the calendar date in Asia/Jakarta (WIB, UTC+7) for the given timestamp.
 *
 * For example:
 * - 2026-09-03T23:30:00.000Z is 2026-09-04 06:30:00 WIB -> returns 2026-09-04T00:00:00.000Z
 * - 2026-09-04T10:00:00.000Z is 2026-09-04 17:00:00 WIB -> returns 2026-09-04T00:00:00.000Z
 */
export function getWibDate(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === 'year')?.value ?? '0', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '0', 10);
  const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '0', 10);
  return new Date(Date.UTC(year, month - 1, day));
}
