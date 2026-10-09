import { Injectable } from '@nestjs/common';
import { HrBriefRepository, BRIEF_DETAIL_LIMIT } from './hr-brief.repository';
import { HrBriefQueryDto } from './dto/hr-brief-query.dto';
import { resolveBriefPeriod } from './hr-brief-period';

const dateString = (date: Date) => date.toISOString().slice(0, 10);
function collection<T>(total: number, items: T[]) {
  return {
    total,
    items,
    remaining: Math.max(0, total - items.length),
    limit: BRIEF_DETAIL_LIMIT,
  };
}

@Injectable()
export class HrBriefService {
  constructor(private readonly repository: HrBriefRepository) {}

  async read(query: HrBriefQueryDto) {
    const now = new Date();
    const period = resolveBriefPeriod(query, now);
    const records = await this.repository.read(period, query.departmentId);
    const attendance = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      recordedEmployeeDays: 0,
    };
    for (const group of records.attendance) {
      attendance[group.status] = group._count._all;
      attendance.recordedEmployeeDays += group._count._all;
    }
    const payrollTotal = records.payrollGroups.reduce(
      (total, group) => total + group._count._all,
      0,
    );
    return {
      period: {
        startDate: dateString(period.startDate),
        endDate: dateString(period.endDate),
      },
      referenceDate: dateString(period.referenceDate),
      timezone: 'Asia/Jakarta' as const,
      generatedAt: now.toISOString(),
      departmentId: query.departmentId ?? null,
      contractHorizon: { days: 30, endDate: dateString(period.horizonEnd) },
      attendance,
      open: {
        total:
          records.leaveTotal +
          records.upcomingTotal +
          records.expiredTotal +
          payrollTotal,
        leaves: collection(
          records.leaveTotal,
          records.leaves.map((leave) => ({
            ...leave,
            datesPassed: leave.endDate < period.referenceDate,
          })),
        ),
        upcomingContracts: collection(
          records.upcomingTotal,
          records.upcomingContracts,
        ),
        expiredActiveContracts: collection(
          records.expiredTotal,
          records.expiredContracts,
        ),
        payrolls: {
          ...collection(payrollTotal, records.payrollDetails),
          groups: records.payrollGroups.map((group) => ({
            periodStart: dateString(group.periodStart),
            periodEnd: dateString(group.periodEnd),
            status: group.status,
            total: group._count._all,
          })),
        },
      },
    };
  }
}
