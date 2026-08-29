import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReportingLineRepository } from './reporting-line.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateReportingLineDto } from './dto/create-reporting-line.dto';
import { ReportingLineResponseDto } from './dto/reporting-line-response.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class ReportingLineService {
  private readonly logger = new Logger(ReportingLineService.name);

  constructor(
    private readonly repository: ReportingLineRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    employeeId: string,
    dto: CreateReportingLineDto,
    currentUser: AuthenticatedUser,
  ): Promise<ReportingLineResponseDto> {
    if (employeeId === dto.managerId) {
      throw new BadRequestException(
        'Karyawan tidak dapat dijadikan atasan untuk dirinya sendiri (self-reporting tidak diizinkan)',
      );
    }

    const subordinate = await this.repository.findEmployeeById(employeeId);
    if (!subordinate || subordinate.deletedAt !== null) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const manager = await this.repository.findEmployeeById(dto.managerId);
    if (!manager || manager.deletedAt !== null) {
      throw new NotFoundException(
        `Manager/Atasan dengan ID '${dto.managerId}' tidak ditemukan`,
      );
    }

    const effectiveFromDate = new Date(dto.effectiveFrom);
    if (isNaN(effectiveFromDate.getTime())) {
      throw new BadRequestException('Format tanggal effectiveFrom tidak valid');
    }

    const isPrimary = dto.isPrimary !== undefined ? dto.isPrimary : true;

    // 1. Eksekusi transaksi atomik: auto-close primary lama + create line baru
    const created = await this.repository.createWithAutoCloseTransaction(
      employeeId,
      {
        employeeId,
        managerId: dto.managerId,
        effectiveFrom: effectiveFromDate,
        effectiveTo: null,
        isPrimary,
      },
      isPrimary,
    );

    const response = this.mapToResponse(created);

    // 3. Audit logging
    try {
      await this.auditLogService.record({
        action: 'CREATE_REPORTING_LINE',
        entity: 'EmployeeReportingLine',
        entityId: created.id,
        actorId: currentUser.userId,
        after: response as any,
        source: 'USER',
      });
    } catch (err: any) {
      this.logger.error(
        'Gagal mencatat audit log create reporting line',
        err?.stack,
      );
    }

    return response;
  }

  async findActiveByEmployeeId(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<ReportingLineResponseDto | null> {
    await this.assertAccess(employeeId, currentUser);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const active =
      await this.repository.findActivePrimaryByEmployeeId(employeeId);
    return active ? this.mapToResponse(active) : null;
  }

  async findHistoryByEmployeeId(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ data: ReportingLineResponseDto[] }> {
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

  private mapToResponse(line: any): ReportingLineResponseDto {
    return {
      id: line.id,
      employeeId: line.employeeId,
      managerId: line.managerId,
      manager: line.manager
        ? {
            id: line.manager.id,
            nip: line.manager.nip,
            fullName: line.manager.fullName,
            jobTitle: line.manager.jobTitle,
            email: line.manager.email,
          }
        : null,
      effectiveFrom: line.effectiveFrom,
      effectiveTo: line.effectiveTo,
      isPrimary: line.isPrimary,
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
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
          'Anda hanya dapat melihat garis pelaporan Anda sendiri',
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
          'Anda hanya dapat melihat garis pelaporan karyawan di departemen Anda',
        );
      }
    }
  }
}
