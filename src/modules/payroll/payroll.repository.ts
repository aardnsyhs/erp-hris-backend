import { Injectable } from '@nestjs/common';
import { Employee, Payroll, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  async findByEmployeeAndPeriod(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Payroll | null> {
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
