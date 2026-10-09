import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveBriefPeriod } from './hr-brief-period';

export const BRIEF_DETAIL_LIMIT = 20;
const employeeSelect = { id: true, fullName: true, nip: true } as const;

@Injectable()
export class HrBriefRepository {
  constructor(private readonly prisma: PrismaService) {}

  read(period: ReturnType<typeof resolveBriefPeriod>, departmentId?: string) {
    const employee = {
      deletedAt: null,
      ...(departmentId ? { departmentId } : {}),
    };
    const pending: Prisma.LeaveRequestWhereInput = {
      employee,
      status: 'PENDING',
    };
    const contract: Prisma.EmploymentContractWhereInput = {
      employee,
      status: 'ACTIVE',
    };
    const upcoming = {
      ...contract,
      endDate: { gte: period.referenceDate, lte: period.horizonEnd },
    };
    const expired = { ...contract, endDate: { lt: period.referenceDate } };
    const payroll: Prisma.PayrollWhereInput = {
      employee,
      deletedAt: null,
      status: { in: ['DRAFT', 'PROCESSED'] },
    };
    const contractSelect = {
      id: true,
      employeeId: true,
      contractNumber: true,
      endDate: true,
      employee: { select: employeeSelect },
    } as const;
    // Keep totals and bounded details on the same database snapshot.
    return this.prisma.$transaction(
      async (tx) => {
        const [
          attendance,
          leaveTotal,
          leaves,
          upcomingTotal,
          upcomingContracts,
          expiredTotal,
          expiredContracts,
          payrollGroups,
          payrollDetails,
        ] = await Promise.all([
          tx.attendance.groupBy({
            by: ['status'],
            where: {
              employee,
              attendanceDate: { gte: period.startDate, lte: period.endDate },
            },
            _count: { _all: true },
          }),
          tx.leaveRequest.count({ where: pending }),
          tx.leaveRequest.findMany({
            where: pending,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: BRIEF_DETAIL_LIMIT,
            select: {
              id: true,
              employeeId: true,
              startDate: true,
              endDate: true,
              createdAt: true,
              employee: { select: employeeSelect },
            },
          }),
          tx.employmentContract.count({ where: upcoming }),
          tx.employmentContract.findMany({
            where: upcoming,
            orderBy: [{ endDate: 'asc' }, { id: 'asc' }],
            take: BRIEF_DETAIL_LIMIT,
            select: contractSelect,
          }),
          tx.employmentContract.count({ where: expired }),
          tx.employmentContract.findMany({
            where: expired,
            orderBy: [{ endDate: 'asc' }, { id: 'asc' }],
            take: BRIEF_DETAIL_LIMIT,
            select: contractSelect,
          }),
          tx.payroll.groupBy({
            by: ['periodStart', 'periodEnd', 'status'],
            where: payroll,
            _count: { _all: true },
            orderBy: [{ periodStart: 'asc' }, { status: 'asc' }],
          }),
          tx.payroll.findMany({
            where: payroll,
            take: BRIEF_DETAIL_LIMIT,
            orderBy: [{ periodStart: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              employeeId: true,
              periodStart: true,
              periodEnd: true,
              status: true,
              employee: { select: employeeSelect },
            },
          }),
        ]);
        return {
          attendance,
          leaveTotal,
          leaves,
          upcomingTotal,
          upcomingContracts,
          expiredTotal,
          expiredContracts,
          payrollGroups,
          payrollDetails,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
