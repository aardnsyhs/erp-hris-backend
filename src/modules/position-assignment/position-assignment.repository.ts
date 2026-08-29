import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PositionAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByEmployeeId(employeeId: string) {
    return this.prisma.employeePositionAssignment.findFirst({
      where: {
        employeeId,
        effectiveTo: null,
      },
      include: {
        position: true,
        department: true,
      },
    });
  }

  async closeActiveAssignment(
    employeeId: string,
    effectiveTo: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.employeePositionAssignment.updateMany({
      where: {
        employeeId,
        effectiveTo: null,
      },
      data: {
        effectiveTo,
      },
    });
  }

  async create(
    data: Prisma.EmployeePositionAssignmentUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.employeePositionAssignment.create({
      data,
      include: {
        position: true,
        department: true,
        assignedBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findHistoryByEmployeeId(employeeId: string) {
    return this.prisma.employeePositionAssignment.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        position: true,
        department: true,
        assignedBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findEmployeeById(employeeId: string) {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    });
  }

  async findPositionById(positionId: string) {
    return this.prisma.position.findUnique({
      where: { id: positionId },
    });
  }

  async findDepartmentById(departmentId: string) {
    return this.prisma.department.findUnique({
      where: { id: departmentId },
    });
  }
}
