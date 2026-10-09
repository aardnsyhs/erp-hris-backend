import { BadRequestException } from '@nestjs/common';
import { addCalendarDays, getWibDate } from '../../common/utils/timezone.util';
import { HrBriefQueryDto } from './dto/hr-brief-query.dto';

function calendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Invalid calendar date; use YYYY-MM-DD');
  }
  return date;
}

export function resolveBriefPeriod(query: HrBriefQueryDto, now: Date) {
  const referenceDate = getWibDate(now);
  const endDate = query.endDate ? calendarDate(query.endDate) : referenceDate;
  const startDate = query.startDate
    ? calendarDate(query.startDate)
    : addCalendarDays(endDate, -6);
  const days = (endDate.getTime() - startDate.getTime()) / 86_400_000 + 1;
  if (days < 1 || days > 90) {
    throw new BadRequestException('Period must contain 1 to 90 calendar days');
  }
  return {
    startDate,
    endDate,
    referenceDate,
    horizonEnd: addCalendarDays(referenceDate, 30),
  };
}
