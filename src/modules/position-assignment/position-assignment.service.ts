import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AssignmentType, MovementType, UserRole } from '@prisma/client';
import { PositionAssignmentRepository } from './position-assignment.repository';
import { MovementHistoryService } from '../movement-history/movement-history.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePositionAssignmentDto } from './dto/create-position-assignment.dto';
import { PositionAssignmentResponseDto } from './dto/position-assignment-response.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class PositionAssignmentService {
  private readonly logger = new Logger(PositionAssignmentService.name);

  constructor(
    private readonly repository: PositionAssignmentRepository,
    private readonly movementHistoryService: MovementHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    employeeId: string,
    dto: CreatePositionAssignmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<PositionAssignmentResponseDto> {
    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee || employee.deletedAt !== null) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const position = await this.repository.findPositionById(dto.positionId);
    if (!position) {
      throw new NotFoundException(
        `Posisi dengan ID '${dto.positionId}' tidak ditemukan`,
      );
    }
    if (!position.isActive) {
      throw new BadRequestException(
        `Posisi '${position.title}' sedang non-aktif dan tidak dapat ditugaskan`,
      );
    }

    const department = await this.repository.findDepartmentById(
      dto.departmentId,
    );
    if (!department) {
      throw new NotFoundException(
        `Departemen dengan ID '${dto.departmentId}' tidak ditemukan`,
      );
    }

    const effectiveFromDate = new Date(dto.effectiveFrom);
    if (isNaN(effectiveFromDate.getTime())) {
      throw new BadRequestException('Format tanggal effectiveFrom tidak valid');
    }

    // Ambil penugasan aktif saat ini sebelum ditutup
    const currentActive =
      await this.repository.findActiveByEmployeeId(employeeId);

    // 1. Auto-close previous active assignment
    if (currentActive) {
      await this.repository.closeActiveAssignment(
        employeeId,
        effectiveFromDate,
      );
    }

    // 2. Buat assignment baru
    const created = await this.repository.create({
      employeeId,
      positionId: dto.positionId,
      departmentId: dto.departmentId,
      effectiveFrom: effectiveFromDate,
      effectiveTo: null,
      assignmentType: dto.assignmentType,
      notes: dto.notes?.trim() || null,
      assignedById: currentUser.userId,
    });

    // 3. Otomatis catat entri EmployeeMovementHistory
    const movementType = this.mapAssignmentToMovementType(dto.assignmentType);
    try {
      await this.movementHistoryService.recordMovement({
        employeeId,
        movementType,
        fromPositionId: currentActive?.positionId || null,
        toPositionId: dto.positionId,
        fromDepartmentId: currentActive?.departmentId || null,
        toDepartmentId: dto.departmentId,
        effectiveDate: effectiveFromDate,
        reason: dto.notes || `Penugasan posisi ${dto.assignmentType}`,
        performedById: currentUser.userId,
      });
    } catch (err: any) {
      this.logger.error(
        'Gagal mencatat movement history untuk assignment',
        err?.stack,
      );
    }

    // 4. Audit Logging
    const response = this.mapToResponse(created);
    try {
      await this.auditLogService.record({
        action: 'CREATE_POSITION_ASSIGNMENT',
        entity: 'EmployeePositionAssignment',
        entityId: created.id,
        actorId: currentUser.userId,
        after: response as any,
        source: 'USER',
      });
    } catch (err: any) {
      this.logger.error(
        'Gagal mencatat audit log create position assignment',
        err?.stack,
      );
    }

    return response;
  }

  async findActiveByEmployeeId(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<PositionAssignmentResponseDto | null> {
    await this.assertAccess(employeeId, currentUser);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const active = await this.repository.findActiveByEmployeeId(employeeId);
    return active ? this.mapToResponse(active) : null;
  }

  async findHistoryByEmployeeId(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ data: PositionAssignmentResponseDto[] }> {
    await this.assertAccess(employeeId, currentUser);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const histories =
      await this.repository.findHistoryByEmployeeId(employeeId);
    return {
      data: histories.map((h) => this.mapToResponse(h)),
    };
  }

  private mapAssignmentToMovementType(
    assignmentType: AssignmentType,
  ): MovementType {
    switch (assignmentType) {
      case AssignmentType.INITIAL:
        return MovementType.HIRE;
      case AssignmentType.PROMOTION:
        return MovementType.PROMOTION;
      case AssignmentType.TRANSFER:
        return MovementType.TRANSFER;
      case AssignmentType.DEMOTION:
        return MovementType.DEMOTION;
      case AssignmentType.REORGANIZATION:
        return MovementType.REORGANIZATION;
      default:
        return MovementType.TRANSFER;
    }
  }

  private mapToResponse(assignment: any): PositionAssignmentResponseDto {
    return {
      id: assignment.id,
      employeeId: assignment.employeeId,
      positionId: assignment.positionId,
      position: assignment.position
        ? {
            id: assignment.position.id,
            code: assignment.position.code,
            title: assignment.position.title,
            level: assignment.position.level,
          }
        : null,
      departmentId: assignment.departmentId,
      department: assignment.department
        ? {
            id: assignment.department.id,
            code: assignment.department.code,
            name: assignment.department.name,
          }
        : null,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
      assignmentType: assignment.assignmentType,
      notes: assignment.notes,
      assignedById: assignment.assignedById,
      assignedBy: assignment.assignedBy
        ? {
            id: assignment.assignedBy.id,
            email: assignment.assignedBy.email,
            role: assignment.assignedBy.role,
          }
        : null,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
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
          'Anda hanya dapat melihat penugasan posisi Anda sendiri',
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
          'Anda hanya dapat melihat penugasan posisi karyawan di departemen Anda',
        );
      }
    }
  }
}
