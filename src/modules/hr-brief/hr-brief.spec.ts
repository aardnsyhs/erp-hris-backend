import 'reflect-metadata';
import {
  ExecutionContext,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HrBriefController } from './hr-brief.controller';
import { HrBriefQueryDto } from './dto/hr-brief-query.dto';
import { resolveBriefPeriod } from './hr-brief-period';
import { HrBriefRepository } from './hr-brief.repository';
import { HrBriefService } from './hr-brief.service';
import { PrismaService } from '../../prisma/prisma.service';

interface ReadArgs {
  where: {
    employee: { deletedAt: Date | null; departmentId?: string };
    status?: string | { in: string[] };
    endDate?: { gte?: Date; lte?: Date; lt?: Date };
    attendanceDate?: { gte: Date; lte: Date };
    deletedAt?: null;
  };
  orderBy?: Record<string, string>[];
  select?: Record<string, unknown>;
}

describe('HR Brief access and periods', () => {
  it.each([
    ['HR_ADMIN', true],
    ['MANAGER', false],
    ['EMPLOYEE', false],
    [undefined, false],
  ])('allows %s: %s', (role, allowed) => {
    const context = {
      getClass: () => HrBriefController,
      getHandler: () => () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    } as unknown as ExecutionContext;
    expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(allowed);
  });

  it('uses WIB calendar boundaries even while UTC is still the previous day', () => {
    const period = resolveBriefPeriod({}, new Date('2026-10-07T17:00:00Z'));
    expect(period.referenceDate.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(period.startDate.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(period.horizonEnd.toISOString()).toBe('2026-11-07T00:00:00.000Z');
    expect(
      resolveBriefPeriod(
        {},
        new Date('2026-10-07T16:59:59Z'),
      ).endDate.toISOString(),
    ).toBe('2026-10-07T00:00:00.000Z');
  });

  it.each([
    { startDate: '2026-02-29' },
    { startDate: '2026-02-30' },
    { startDate: '2026-13-01' },
    { startDate: '2026-10-09', endDate: '2026-10-08' },
    { startDate: '2026-01-01', endDate: '2026-04-01' },
    { startDate: '2026-10-01T00:00:00Z' },
  ])('rejects invalid ranges %j', (query) => {
    expect(() => resolveBriefPeriod(query, new Date('2026-10-08'))).toThrow(
      BadRequestException,
    );
  });

  it('accepts leap dates and exactly 90 inclusive days', () => {
    expect(
      resolveBriefPeriod(
        { startDate: '2024-02-29', endDate: '2024-02-29' },
        new Date(),
      ),
    ).toBeDefined();
    expect(
      resolveBriefPeriod(
        { startDate: '2026-01-01', endDate: '2026-03-31' },
        new Date(),
      ),
    ).toBeDefined();
  });

  it('validates query shape and department IDs with the application validation pipe', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { departmentId: 'not-a-uuid' },
        { type: 'query', metatype: HrBriefQueryDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { startDate: '2026-10-08T00:00:00Z' },
        { type: 'query', metatype: HrBriefQueryDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { horizon: 0 },
        { type: 'query', metatype: HrBriefQueryDto },
      ),
    ).rejects.toThrow();
  });
});

describe('HR Brief aggregation', () => {
  it('keeps full totals beyond the 20-row detail limit and does not invent absent days', async () => {
    const repository = {
      read: jest.fn().mockResolvedValue({
        attendance: [
          { status: 'PRESENT', _count: { _all: 201 } },
          { status: 'LATE', _count: { _all: 37 } },
        ],
        leaveTotal: 81,
        leaves: [
          {
            id: 'old-pending',
            startDate: new Date('2020-01-01'),
            endDate: new Date('2020-01-02'),
          },
        ],
        upcomingTotal: 30,
        upcomingContracts: Array.from({ length: 20 }, (_, i) => ({
          id: `contract-${i}`,
        })),
        expiredTotal: 2,
        expiredContracts: [],
        payrollGroups: [
          {
            status: 'DRAFT',
            periodStart: new Date('2020-01-01'),
            periodEnd: new Date('2020-01-31'),
            _count: { _all: 145 },
          },
        ],
        payrollDetails: [],
      }),
    };
    const result = await new HrBriefService(
      repository as unknown as HrBriefRepository,
    ).read({ startDate: '2026-10-01', endDate: '2026-10-02' });
    expect(result.attendance).toEqual({
      PRESENT: 201,
      LATE: 37,
      ABSENT: 0,
      recordedEmployeeDays: 238,
    });
    expect(result.open.total).toBe(258);
    expect(result.open.leaves.remaining).toBe(80);
    expect(result.open.leaves.items[0].datesPassed).toBe(true);
    expect(result.open.upcomingContracts.remaining).toBe(10);
    expect(result.open.payrolls.total).toBe(145);
    expect(result.open.payrolls.groups[0].total).toBe(145);
  });

  it('queries current pending work independently, filters deleted records and uses inclusive contract horizon', async () => {
    const delegate = () => ({
      groupBy: jest.fn<Promise<unknown[]>, [ReadArgs]>().mockResolvedValue([]),
      count: jest.fn<Promise<number>, [ReadArgs]>().mockResolvedValue(0),
      findMany: jest.fn<Promise<unknown[]>, [ReadArgs]>().mockResolvedValue([]),
    });
    const tx = {
      attendance: delegate(),
      leaveRequest: delegate(),
      employmentContract: delegate(),
      payroll: delegate(),
    };
    const prisma = {
      $transaction: jest.fn<
        Promise<unknown>,
        [(client: typeof tx) => Promise<unknown>, { isolationLevel: string }]
      >(async (callback) => callback(tx)),
    };
    const period = resolveBriefPeriod(
      { startDate: '2025-01-01', endDate: '2025-01-07' },
      new Date('2026-10-08T00:00:00Z'),
    );
    await new HrBriefRepository(prisma as unknown as PrismaService).read(
      period,
      'department-1',
    );
    const scope = { deletedAt: null, departmentId: 'department-1' };
    expect(tx.leaveRequest.count).toHaveBeenCalledWith({
      where: { employee: scope, status: 'PENDING' },
    });
    expect(tx.leaveRequest.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
    const upcoming = tx.employmentContract.count.mock.calls[0][0].where;
    expect(upcoming).toEqual({
      employee: scope,
      status: 'ACTIVE',
      endDate: { gte: period.referenceDate, lte: period.horizonEnd },
    });
    const expires = (
      end: Date | null,
      status = 'ACTIVE',
      deletedAt: Date | null = null,
    ) =>
      end !== null &&
      status === upcoming.status &&
      deletedAt === upcoming.employee.deletedAt &&
      end >= upcoming.endDate!.gte! &&
      end <= upcoming.endDate!.lte!;
    expect(expires(period.referenceDate)).toBe(true);
    expect(expires(period.horizonEnd)).toBe(true);
    expect(expires(new Date('2026-11-08'))).toBe(false);
    expect(expires(new Date('2026-10-07'))).toBe(false);
    expect(expires(null)).toBe(false);
    for (const status of ['EXPIRED', 'TERMINATED', 'RENEWED'])
      expect(expires(period.referenceDate, status)).toBe(false);
    expect(expires(period.referenceDate, 'ACTIVE', new Date())).toBe(false);
    expect(tx.employmentContract.count.mock.calls[1][0].where.endDate).toEqual({
      lt: period.referenceDate,
    });
    expect(tx.payroll.groupBy.mock.calls[0][0].where).toEqual({
      employee: scope,
      deletedAt: null,
      status: { in: ['DRAFT', 'PROCESSED'] },
    });
    expect(tx.attendance.groupBy.mock.calls[0][0].where.attendanceDate).toEqual(
      { gte: period.startDate, lte: period.endDate },
    );
    expect(
      tx.leaveRequest.findMany.mock.calls[0][0].select?.reason,
    ).toBeUndefined();
    expect(
      tx.payroll.findMany.mock.calls[0][0].select?.netSalary,
    ).toBeUndefined();
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: 'RepeatableRead',
    });
  });
});
