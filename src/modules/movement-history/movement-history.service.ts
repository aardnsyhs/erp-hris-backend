import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MovementType, UserRole } from '@prisma/client';
import {
  CreateMovementHistoryInput,
  MovementHistoryRepository,
} from './movement-history.repository';
import { MovementHistoryResponseDto } from './dto/movement-history-response.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class MovementHistoryService {
  constructor(private readonly repository: MovementHistoryRepository) {}

  /**
   * Internal method to append movement history.
   * NEVER exposed as a public user endpoint.
   */
  async recordMovement(input: CreateMovementHistoryInput) {
    return this.repository.create(input);
  }

  async findByEmployeeId(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ data: MovementHistoryResponseDto[] }> {
    await this.assertAccess(employeeId, currentUser);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const histories = await this.repository.findByEmployeeId(employeeId);

    const data: MovementHistoryResponseDto[] = histories.map((h) => ({
      id: h.id,
      employeeId: h.employeeId,
      movementType: h.movementType,
      fromPositionId: h.fromPositionId,
      fromPosition: h.fromPosition
        ? {
            id: h.fromPosition.id,
            code: h.fromPosition.code,
            title: h.fromPosition.title,
            level: h.fromPosition.level,
          }
        : null,
      toPositionId: h.toPositionId,
      toPosition: h.toPosition
        ? {
            id: h.toPosition.id,
            code: h.toPosition.code,
            title: h.toPosition.title,
            level: h.toPosition.level,
          }
        : null,
      fromDepartmentId: h.fromDepartmentId,
      fromDepartment: h.fromDepartment
        ? {
            id: h.fromDepartment.id,
            code: h.fromDepartment.code,
            name: h.fromDepartment.name,
          }
        : null,
      toDepartmentId: h.toDepartmentId,
      toDepartment: h.toDepartment
        ? {
            id: h.toDepartment.id,
            code: h.toDepartment.code,
            name: h.toDepartment.name,
          }
        : null,
      effectiveDate: h.effectiveDate,
      reason: h.reason,
      performedById: h.performedById,
      performedBy: h.performedBy
        ? {
            id: h.performedBy.id,
            email: h.performedBy.email,
            role: h.performedBy.role,
          }
        : null,
      createdAt: h.createdAt,
    }));

    return { data };
  }

  private async assertAccess(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === UserRole.HR_ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== employeeId) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat riwayat pergerakan Anda sendiri',
        );
      }
      return;
    }

    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        throw new ForbiddenException(
          'Akun Manager tidak terhubung dengan data karyawan',
        );
      }

      const targetEmployee =
        await this.repository.findEmployeeById(employeeId);
      if (!targetEmployee) {
        throw new NotFoundException(
          `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
        );
      }

      const managerEmployee = await this.repository.findEmployeeById(
        currentUser.employeeId,
      );
      if (
        !managerEmployee ||
        managerEmployee.departmentId !== targetEmployee.departmentId
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat riwayat pergerakan karyawan di departemen Anda',
        );
      }
    }
  }
}
