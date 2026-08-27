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
