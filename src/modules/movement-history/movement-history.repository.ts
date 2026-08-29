import { Injectable } from '@nestjs/common';
import { Prisma, MovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateMovementHistoryInput {
  employeeId: string;
  movementType: MovementType;
  fromPositionId?: string | null;
  toPositionId?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  effectiveDate: Date;
  reason?: string | null;
  performedById: string;
}

@Injectable()
export class MovementHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMovementHistoryInput) {
    return this.prisma.employeeMovementHistory.create({
      data: {
        employeeId: data.employeeId,
        movementType: data.movementType,
        fromPositionId: data.fromPositionId,
        toPositionId: data.toPositionId,
        fromDepartmentId: data.fromDepartmentId,
        toDepartmentId: data.toDepartmentId,
        effectiveDate: data.effectiveDate,
        reason: data.reason,
        performedById: data.performedById,
      },
      include: {
        fromPosition: true,
        toPosition: true,
        fromDepartment: true,
        toDepartment: true,
        performedBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findByEmployeeId(employeeId: string) {
    return this.prisma.employeeMovementHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' },
      include: {
        fromPosition: true,
        toPosition: true,
        fromDepartment: true,
        toDepartment: true,
        performedBy: {
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
}
