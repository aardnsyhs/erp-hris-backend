import {
  demoAttendance,
  demoLeaveDates,
  demoPeriods,
  seedDatabaseUrl,
  DEMO_CONTRACT_OFFSETS,
  DEMO_PAYROLL_STATUSES,
} from '../../../prisma/seed-data';
import { classifyCheckIn } from './timezone.util';

const schedule = {
  startTime: '09:00',
  lateToleranceMinutes: 15,
  standardWorkMinutes: 480,
};
const today = new Date('2026-10-08T00:00:00Z');
describe('Application database demo seed', () => {
  it('uses DATABASE_URL unchanged, including schema parameters and remote hosts', () => {
    for (const value of [
      'postgresql://demo:demo@localhost:5432/erp_hris_db?schema=public',
      'postgresql://demo:demo@vps.example.com/erp_hris_db?schema=public',
    ])
      expect(seedDatabaseUrl({ DATABASE_URL: value })).toBe(value);
    for (const value of [undefined, '', '   ']) {
      expect(() => seedDatabaseUrl({ DATABASE_URL: value })).toThrow(
        'DATABASE_URL is required',
      );
    }
  });

  it('stores WIB in UTC and classifies the exact tolerance boundary with application rules', () => {
    const now = new Date('2026-10-08T14:00:00Z');
    const present = demoAttendance(today, now, schedule, false, 9 * 60 + 15)!;
    const late = demoAttendance(today, now, schedule, false, 9 * 60 + 16)!;
    expect(present.checkIn?.toISOString()).toBe('2026-10-08T02:15:00.000Z');
    expect(present.status).toBe('PRESENT');
    expect(late.status).toBe('LATE');
    expect(late.status).toBe(classifyCheckIn(late.checkIn!, schedule));
    expect(
      classifyCheckIn(new Date('2026-10-08T02:15:00Z'), {
        startTime: '08:30',
        lateToleranceMinutes: 10,
      }),
    ).toBe('LATE');
  });

  it('does not seed future check-ins/checkouts or present-day absences', () => {
    const now = new Date('2026-10-08T04:00:00Z');
    expect(
      demoAttendance(today, now, schedule, false, 540)?.checkOut,
    ).toBeNull();
    expect(demoAttendance(today, now, schedule, false, 720)).toBeNull();
    expect(demoAttendance(today, now, schedule, true, 540)).toBeNull();
    const prior = demoAttendance(
      new Date('2026-10-07'),
      now,
      schedule,
      true,
      540,
    )!;
    expect(prior).toMatchObject({
      status: 'ABSENT',
      checkIn: null,
      checkOut: null,
    });
  });

  it('has fixed old/future pending scenarios, contract edges and all payroll states', () => {
    expect(DEMO_CONTRACT_OFFSETS).toEqual([7, 14, 30, 45, -1]);
    expect(DEMO_PAYROLL_STATUSES).toEqual(['DRAFT', 'PROCESSED', 'PAID']);
    expect(demoLeaveDates(today, 0).end < today).toBe(true);
    expect(demoLeaveDates(today, 1).start > today).toBe(true);
    expect(
      demoPeriods(new Date('2027-01-01')).map((period) =>
        period.start.toISOString().slice(0, 10),
      ),
    ).toEqual(['2026-11-01', '2026-12-01']);
    expect(demoPeriods(today)[1].end.toISOString().slice(0, 10)).toBe(
      '2026-09-30',
    );
  });
});
