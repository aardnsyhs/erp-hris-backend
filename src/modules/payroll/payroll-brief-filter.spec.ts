import { ValidationPipe } from '@nestjs/common';
import { PayrollRepository } from './payroll.repository';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import { PrismaService } from '../../prisma/prisma.service';

describe('Payroll source filters from HR Brief', () => {
  it('uses exact boundaries for both rows and totals, excluding soft-deleted payroll and employees', async () => {
    type Query = {
      where: {
        periodStart?: { gte?: Date; equals?: Date };
        [key: string]: unknown;
      };
    };
    const prisma = {
      payroll: {
        findMany: jest.fn<Promise<unknown[]>, [Query]>().mockResolvedValue([]),
        count: jest.fn<Promise<number>, [Query]>().mockResolvedValue(0),
      },
    };
    const repository = new PayrollRepository(
      prisma as unknown as PrismaService,
    );
    const filters = {
      periodStart: new Date('2026-09-01'),
      periodEnd: new Date('2026-09-30'),
      exactPeriod: true,
      status: 'DRAFT' as const,
      departmentId: 'dept-1',
    };
    await repository.findAll({ ...filters, skip: 0, take: 10 });
    await repository.countAll(filters);
    const expected = {
      deletedAt: null,
      employee: { deletedAt: null, departmentId: 'dept-1' },
      status: 'DRAFT',
      periodStart: { equals: filters.periodStart },
      periodEnd: { equals: filters.periodEnd },
    };
    expect(prisma.payroll.findMany.mock.calls[0][0].where).toEqual(expected);
    expect(prisma.payroll.count).toHaveBeenCalledWith({ where: expected });
    await repository.countAll({ ...filters, exactPeriod: false });
    expect(prisma.payroll.count.mock.calls[1][0].where.periodStart).toEqual({
      gte: filters.periodStart,
    });
  });

  it('accepts boolean query flags and rejects unknown values', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const query = (await pipe.transform(
      { exactPeriod: 'true' },
      { type: 'query', metatype: PayrollQueryDto },
    )) as PayrollQueryDto;
    expect(query.exactPeriod).toBe(true);
    const standard = (await pipe.transform(
      { exactPeriod: 'false' },
      { type: 'query', metatype: PayrollQueryDto },
    )) as PayrollQueryDto;
    expect(standard.exactPeriod).toBe(false);
    await expect(
      pipe.transform(
        { exactPeriod: 'maybe' },
        { type: 'query', metatype: PayrollQueryDto },
      ),
    ).rejects.toThrow();
  });
});
