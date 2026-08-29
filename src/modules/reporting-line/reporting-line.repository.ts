import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportingLineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActivePrimaryByEmployeeId(employeeId: string) {
    return this.prisma.employeeReportingLine.findFirst({
      where: {
        employeeId,
        isPrimary: true,
        effectiveTo: null,
      },
      include: {
        manager: true,
      },
    });
  }

  async closeActivePrimary(
    employeeId: string,
    effectiveTo: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.employeeReportingLine.updateMany({
      where: {
        employeeId,
        isPrimary: true,
        effectiveTo: null,
      },
      data: {
        effectiveTo,
      },
    });
  }

  async create(
    data: Prisma.EmployeeReportingLineUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.employeeReportingLine.create({
      data,
      include: {
        manager: true,
      },
    });
  }

  async findHistoryByEmployeeId(employeeId: string) {
    return this.prisma.employeeReportingLine.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        manager: true,
      },
    });
  }

  async findEmployeeById(employeeId: string) {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    });
  }
}
