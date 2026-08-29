import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EmergencyContactRepository } from './emergency-contact.repository';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';

@Injectable()
export class EmergencyContactService {
  constructor(
    private readonly repository: EmergencyContactRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async assertAccess(
    employeeId: string,
    currentUser: AuthenticatedUser,
    readOnly = false,
  ) {
    if (currentUser.role === UserRole.HR_ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== employeeId) {
        throw new ForbiddenException(
          'Anda hanya dapat mengakses kontak darurat milik Anda sendiri',
        );
      }
      return;
    }

    if (currentUser.role === UserRole.MANAGER) {
      if (!readOnly) {
        throw new ForbiddenException(
          'Manager tidak memiliki izin untuk memodifikasi kontak darurat',
        );
      }

      // Read-only access: verify same department
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        throw new NotFoundException(
          `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
        );
      }

      const managerEmployee = currentUser.employeeId
        ? await this.repository.findEmployeeById(currentUser.employeeId)
        : null;

      if (
        !managerEmployee ||
        managerEmployee.departmentId !== employee.departmentId
      ) {
        throw new ForbiddenException(
          'Manager hanya dapat melihat kontak darurat karyawan di departemen yang sama',
        );
      }
      return;
    }

    throw new ForbiddenException('Akses ditolak');
  }

  async create(
    employeeId: string,
    dto: CreateEmergencyContactDto,
    currentUser: AuthenticatedUser,
  ) {
    await this.assertAccess(employeeId, currentUser, false);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const currentCount = await this.repository.countByEmployeeId(employeeId);
    if (currentCount >= 3) {
      throw new BadRequestException(
        'Maksimal 3 kontak darurat per karyawan telah tercapai',
      );
    }

    const isPrimary =
      dto.isPrimary !== undefined ? dto.isPrimary : currentCount === 0;

    if (isPrimary) {
      await this.repository.resetPrimaryForEmployee(employeeId);
    }

    const created = await this.repository.create({
      employeeId,
      name: dto.name,
      relationship: dto.relationship,
      phone: dto.phone,
      email: dto.email || null,
      isPrimary,
    });

    await this.auditLogService.record({
      action: 'CREATE_EMERGENCY_CONTACT',
      entity: 'EmployeeEmergencyContact',
      entityId: created.id,
      actorId: currentUser.userId,
      after: created as any,
      source: 'USER',
    });

    return created;
  }

  async findByEmployeeId(employeeId: string, currentUser: AuthenticatedUser) {
    await this.assertAccess(employeeId, currentUser, true);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const contacts = await this.repository.findByEmployeeId(employeeId);
    return { data: contacts };
  }

  async update(
    employeeId: string,
    id: string,
    dto: UpdateEmergencyContactDto,
    currentUser: AuthenticatedUser,
  ) {
    await this.assertAccess(employeeId, currentUser, false);

    const existing = await this.repository.findById(id);
    if (!existing || existing.employeeId !== employeeId) {
      throw new NotFoundException(
        `Kontak darurat dengan ID '${id}' tidak ditemukan`,
      );
    }

    if (dto.isPrimary === true) {
      await this.repository.resetPrimaryForEmployee(employeeId, id);
    }

    const updated = await this.repository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.relationship !== undefined
        ? { relationship: dto.relationship }
        : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
    });

    await this.auditLogService.record({
      action: 'UPDATE_EMERGENCY_CONTACT',
      entity: 'EmployeeEmergencyContact',
      entityId: id,
      actorId: currentUser.userId,
      before: existing as any,
      after: updated as any,
      source: 'USER',
    });

    return updated;
  }

  async delete(
    employeeId: string,
    id: string,
    currentUser: AuthenticatedUser,
  ) {
    await this.assertAccess(employeeId, currentUser, false);

    const existing = await this.repository.findById(id);
    if (!existing || existing.employeeId !== employeeId) {
      throw new NotFoundException(
        `Kontak darurat dengan ID '${id}' tidak ditemukan`,
      );
    }

    await this.repository.delete(id);

    await this.auditLogService.record({
      action: 'DELETE_EMERGENCY_CONTACT',
      entity: 'EmployeeEmergencyContact',
      entityId: id,
      actorId: currentUser.userId,
      before: existing as any,
      source: 'USER',
    });

    return {
      message: 'Kontak darurat berhasil dihapus',
    };
  }
}
