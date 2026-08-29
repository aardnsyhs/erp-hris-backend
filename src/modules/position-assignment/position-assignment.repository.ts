import { Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAssignmentWithMovementInput {
  employeeId: string;
  assignmentData: Prisma.EmployeePositionAssignmentUncheckedCreateInput;
  movementData: {
    movementType: MovementType;
    fromPositionId: string | null;
    toPositionId: string;
    fromDepartmentId: string | null;
    toDepartmentId: string;
    effectiveDate: Date;
    reason: string | null;
    performedById: string;
  };
}

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

  /**
   * Atomic interactive transaction:
   * 1. Close current active assignment (if exists) with effectiveTo = newEffectiveFrom.
   * 2. Insert new EmployeePositionAssignment.
   * 3. Insert new EmployeeMovementHistory.
   * If any step fails, entire transaction rolls back cleanly.
   */
  async createAssignmentWithMovementTransaction(
    input: CreateAssignmentWithMovementInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Auto-close previous active assignment
      await tx.employeePositionAssignment.updateMany({
        where: {
          employeeId: input.employeeId,
          effectiveTo: null,
        },
        data: {
          effectiveTo: input.assignmentData.effectiveFrom as Date,
        },
      });

      // 2. Create new position assignment
      const newAssignment = await tx.employeePositionAssignment.create({
        data: input.assignmentData,
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

      // 3. Create EmployeeMovementHistory record
      await tx.employeeMovementHistory.create({
        data: {
          employeeId: input.employeeId,
          movementType: input.movementData.movementType,
          fromPositionId: input.movementData.fromPositionId,
          toPositionId: input.movementData.toPositionId,
          fromDepartmentId: input.movementData.fromDepartmentId,
          toDepartmentId: input.movementData.toDepartmentId,
          effectiveDate: input.movementData.effectiveDate,
          reason: input.movementData.reason,
          performedById: input.movementData.performedById,
        },
      });

      return newAssignment;
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
