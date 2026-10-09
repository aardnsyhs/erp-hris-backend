import { AttendanceStatus } from '@prisma/client';
import {
  addCalendarDays,
  classifyCheckIn,
  getWibDate,
} from '../src/common/utils/timezone.util';

export function seedDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const value = env.DATABASE_URL;
  if (!value?.trim())
    throw new Error('DATABASE_URL is required in .env to run the seed');
  return value;
}

export function wibTimestamp(date: Date, minutes: number): Date {
  return new Date(date.getTime() + (minutes - 7 * 60) * 60_000);
}

export function demoAttendance(
  date: Date,
  now: Date,
  schedule: {
    startTime: string;
    lateToleranceMinutes: number;
    standardWorkMinutes: number;
  },
  absent: boolean,
  arrivalMinutes: number,
) {
  if (absent) {
    // A day still in progress cannot establish an absence.
    if (date.getTime() >= getWibDate(now).getTime()) return null;
    return {
      attendanceDate: date,
      status: AttendanceStatus.ABSENT,
      checkIn: null,
      checkOut: null,
    };
  }
  const checkIn = wibTimestamp(date, arrivalMinutes);
  if (checkIn > now) return null;
  const checkout = new Date(
    checkIn.getTime() + schedule.standardWorkMinutes * 60_000,
  );
  return {
    attendanceDate: date,
    status: classifyCheckIn(checkIn, schedule),
    checkIn,
    checkOut: checkout <= now ? checkout : null,
  };
}

export const DEMO_CONTRACT_OFFSETS = [7, 14, 30, 45, -1] as const;
export const DEMO_PAYROLL_STATUSES = ['DRAFT', 'PROCESSED', 'PAID'] as const;
export function demoPeriods(today: Date) {
  return [-2, -1].map((offset) => ({
    start: new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1),
    ),
    end: new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset + 1, 0),
    ),
  }));
}
export function demoLeaveDates(today: Date, index: number) {
  const start = addCalendarDays(
    today,
    index === 0 ? -20 : index === 1 ? 3 : -40 + index,
  );
  return { start, end: addCalendarDays(start, 1) };
}
