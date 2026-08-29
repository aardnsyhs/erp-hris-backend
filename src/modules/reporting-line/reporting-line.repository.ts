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

  /**
   * Atomic interactive transaction:
   * 1. If isPrimary is true, close existing active primary reporting line with effectiveTo = newEffectiveFrom.
   * 2. Create new reporting line.
   * If any step fails, entire transaction rolls back.
   */
  async createWithAutoCloseTransaction(
    employeeId: string,
    data: Prisma.EmployeeReportingLineUncheckedCreateInput,
    isPrimary: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.employeeReportingLine.updateMany({
          where: {
            employeeId,
            isPrimary: true,
            effectiveTo: null,
          },
          data: {
            effectiveTo: data.effectiveFrom as Date,
          },
        });
      }

      return tx.employeeReportingLine.create({
        data,
        include: {
          manager: true,
        },
      });
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
