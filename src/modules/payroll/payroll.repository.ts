import { Injectable } from '@nestjs/common';
import { Employee, Payroll, PayrollStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type PayrollWithDetails = Prisma.PayrollGetPayload<{
  include: {
    employee: {
      include: {
        department: true;
      };
    };
  };
}>;

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PayrollUncheckedCreateInput): Promise<Payroll> {
    return this.prisma.payroll.create({
      data,
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<PayrollWithDetails | null> {
    return this.prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async findByEmployeeAndPeriod(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayrollWithDetails | null> {
    return this.prisma.payroll.findUnique({
      where: {
        employeeId_periodStart_periodEnd: {
          employeeId,
          periodStart,
          periodEnd,
        },
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async findAll(options: {
    skip: number;
    take: number;
    employeeId?: string;
    departmentId?: string;
    status?: PayrollStatus;
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<PayrollWithDetails[]> {
    const where: Prisma.PayrollWhereInput = {
      ...(options.employeeId && { employeeId: options.employeeId }),
      ...(options.status && { status: options.status }),
      ...(options.departmentId && {
        employee: {
          departmentId: options.departmentId,
        },
      }),
      ...((options.periodStart || options.periodEnd) && {
        periodStart: {
          ...(options.periodStart && { gte: options.periodStart }),
        },
        periodEnd: {
          ...(options.periodEnd && { lte: options.periodEnd }),
        },
      }),
    };

    return this.prisma.payroll.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: { periodStart: 'desc' },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async countAll(options: {
    employeeId?: string;
    departmentId?: string;
    status?: PayrollStatus;
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<number> {
    const where: Prisma.PayrollWhereInput = {
      ...(options.employeeId && { employeeId: options.employeeId }),
      ...(options.status && { status: options.status }),
      ...(options.departmentId && {
        employee: {
          departmentId: options.departmentId,
        },
      }),
      ...((options.periodStart || options.periodEnd) && {
        periodStart: {
          ...(options.periodStart && { gte: options.periodStart }),
        },
        periodEnd: {
          ...(options.periodEnd && { lte: options.periodEnd }),
        },
      }),
    };

    return this.prisma.payroll.count({ where });
  }

  async updateStatusIf(
    id: string,
    fromStatus: PayrollStatus,
    toStatus: PayrollStatus,
    paymentDate?: Date,
  ): Promise<number> {
    const result = await this.prisma.payroll.updateMany({
      where: {
        id,
        status: fromStatus,
      },
      data: {
        status: toStatus,
        ...(paymentDate && { paymentDate }),
      },
    });
    return result.count;
  }

  async updateDraftIf(
    id: string,
    data: {
      allowances: Prisma.Decimal;
      deductions: Prisma.Decimal;
      netSalary: Prisma.Decimal;
    },
  ): Promise<number> {
    const result = await this.prisma.payroll.updateMany({
      where: {
        id,
        status: PayrollStatus.DRAFT,
      },
      data,
    });
    return result.count;
  }

  async deleteDraftIf(id: string): Promise<number> {
    const result = await this.prisma.payroll.deleteMany({
      where: {
        id,
        status: PayrollStatus.DRAFT,
      },
    });
    return result.count;
  }

  async findEmployeeById(employeeId: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
      },
      include: {
        department: true,
      },
    });
  }
}
