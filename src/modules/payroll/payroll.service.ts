import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollStatus, Prisma, UserRole } from '@prisma/client';
import { PayrollRepository, PayrollWithDetails } from './payroll.repository';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import {
  PayrollManagerViewDto,
  PayrollResponseDto,
} from './dto/payroll-response.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class PayrollService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  private getTodayUtcDate(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private mapToFullView(payroll: PayrollWithDetails): PayrollResponseDto {
    return {
      id: payroll.id,
      employeeId: payroll.employeeId,
      employee: payroll.employee
        ? {
            id: payroll.employee.id,
            nip: payroll.employee.nip,
            fullName: payroll.employee.fullName,
            jobTitle: payroll.employee.jobTitle,
            department: payroll.employee.department
              ? {
                  id: payroll.employee.department.id,
                  code: payroll.employee.department.code,
                  name: payroll.employee.department.name,
                }
              : null,
          }
        : null,
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      basicSalary: payroll.basicSalary,
      allowances: payroll.allowances,
      deductions: payroll.deductions,
      netSalary: payroll.netSalary,
      status: payroll.status,
      paymentDate: payroll.paymentDate,
      createdAt: payroll.createdAt,
      updatedAt: payroll.updatedAt,
    };
  }

  private mapToManagerView(payroll: PayrollWithDetails): PayrollManagerViewDto {
    return {
      id: payroll.id,
      employeeId: payroll.employeeId,
      employee: payroll.employee
        ? {
            id: payroll.employee.id,
            nip: payroll.employee.nip,
            fullName: payroll.employee.fullName,
            jobTitle: payroll.employee.jobTitle,
            department: payroll.employee.department
              ? {
                  id: payroll.employee.department.id,
                  code: payroll.employee.department.code,
                  name: payroll.employee.department.name,
                }
              : null,
          }
        : null,
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      status: payroll.status,
      paymentDate: payroll.paymentDate,
      createdAt: payroll.createdAt,
      updatedAt: payroll.updatedAt,
    };
  }

  async create(dto: CreatePayrollDto) {
    // 1. Validasi rentang tanggal
    if (dto.periodEnd < dto.periodStart) {
      throw new BadRequestException(
        'Tanggal akhir periode (periodEnd) tidak boleh lebih awal dari tanggal mulai (periodStart)',
      );
    }

    // 2. Validasi keberadaan employee (dan tidak soft-deleted)
    const employee = await this.payrollRepository.findEmployeeById(
      dto.employeeId,
    );
    if (!employee) {
      throw new BadRequestException(
        `Karyawan dengan ID '${dto.employeeId}' tidak valid atau tidak ditemukan`,
      );
    }

    // 3. Validasi duplikasi periode untuk karyawan yang sama
    const existingPayroll =
      await this.payrollRepository.findByEmployeeAndPeriod(
        dto.employeeId,
        dto.periodStart,
        dto.periodEnd,
      );

    if (existingPayroll) {
      throw new ConflictException(
        'Payroll untuk karyawan pada periode tersebut sudah terdaftar',
      );
    }

    // 4. Decimal-safe snapshotting dan kalkulasi netSalary
    const basicSalary = new Prisma.Decimal(employee.baseSalary);
    const allowances = new Prisma.Decimal(dto.allowances ?? 0);
    const deductions = new Prisma.Decimal(dto.deductions ?? 0);
    const netSalary = basicSalary.plus(allowances).minus(deductions);

    // 5. Insert ke database dengan status DRAFT
    const created = await this.payrollRepository.create({
      employeeId: dto.employeeId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      basicSalary,
      allowances,
      deductions,
      netSalary,
      status: PayrollStatus.DRAFT,
    });

    await this.auditLogService.record({
      action: 'CREATE',
      entity: 'Payroll',
      entityId: created.id,
      after: created,
      source: 'USER',
    });

    const fullPayroll = await this.payrollRepository.findById(created.id);
    return fullPayroll ? this.mapToFullView(fullPayroll) : created;
  }

  async process(id: string) {
    const existing = await this.payrollRepository.findById(id);

    const updatedCount = await this.payrollRepository.updateStatusIf(
      id,
      PayrollStatus.DRAFT,
      PayrollStatus.PROCESSED,
    );

    if (updatedCount === 0) {
      const payroll = await this.payrollRepository.findById(id);
      if (!payroll) {
        throw new NotFoundException(
          `Payroll dengan ID '${id}' tidak ditemukan`,
        );
      }
      throw new ConflictException(
        `Hanya payroll dengan status DRAFT yang dapat diproses, status saat ini: ${payroll.status}`,
      );
    }

    const payroll = await this.payrollRepository.findById(id);

    await this.auditLogService.record({
      action: 'PROCESS',
      entity: 'Payroll',
      entityId: id,
      before: existing,
      after: payroll,
      source: 'USER',
    });

    return payroll ? this.mapToFullView(payroll) : null;
  }

  async pay(id: string) {
    const existing = await this.payrollRepository.findById(id);
    const todayUtc = this.getTodayUtcDate();
    const updatedCount = await this.payrollRepository.updateStatusIf(
      id,
      PayrollStatus.PROCESSED,
      PayrollStatus.PAID,
      todayUtc,
    );

    if (updatedCount === 0) {
      const payroll = await this.payrollRepository.findById(id);
      if (!payroll) {
        throw new NotFoundException(
          `Payroll dengan ID '${id}' tidak ditemukan`,
        );
      }
      throw new ConflictException(
        `Hanya payroll dengan status PROCESSED yang dapat dibayarkan, status saat ini: ${payroll.status}`,
      );
    }

    const payroll = await this.payrollRepository.findById(id);

    await this.auditLogService.record({
      action: 'PAY',
      entity: 'Payroll',
      entityId: id,
      before: existing,
      after: payroll,
      source: 'USER',
    });

    return payroll ? this.mapToFullView(payroll) : null;
  }

  /**
   * Catatan terkait konkurensi pada update():
   * Operasi ini terlindungi dari transisi status (misal payroll berubah ke PROCESSED/PAID)
   * melalui atomic condition WHERE status: DRAFT. Namun, karena status tetap DRAFT sebelum
   * dan sesudah update, terdapat batasan: dua request update konkuren yang mengedit allowances
   * dan deductions secara terpisah berpotensi mengalami lost-update. Untuk Phase 1 hal ini
   * diterima sebagai limitasi yang didokumentasikan.
   */
  async update(id: string, dto: UpdatePayrollDto) {
    const payroll = await this.payrollRepository.findById(id);
    if (!payroll) {
      throw new NotFoundException(`Payroll dengan ID '${id}' tidak ditemukan`);
    }

    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new ConflictException(
        `Hanya payroll dengan status DRAFT yang dapat diubah nilai keuangannya, status saat ini: ${payroll.status}`,
      );
    }

    const allowances =
      dto.allowances !== undefined
        ? new Prisma.Decimal(dto.allowances)
        : new Prisma.Decimal(payroll.allowances);

    const deductions =
      dto.deductions !== undefined
        ? new Prisma.Decimal(dto.deductions)
        : new Prisma.Decimal(payroll.deductions);

    const basicSalary = new Prisma.Decimal(payroll.basicSalary);
    const netSalary = basicSalary.plus(allowances).minus(deductions);

    const updatedCount = await this.payrollRepository.updateDraftIf(id, {
      allowances,
      deductions,
      netSalary,
    });

    if (updatedCount === 0) {
      throw new ConflictException(
        'Gagal memperbarui payroll: status payroll telah berubah dari DRAFT',
      );
    }

    const updatedPayroll = await this.payrollRepository.findById(id);

    await this.auditLogService.record({
      action: 'UPDATE',
      entity: 'Payroll',
      entityId: id,
      before: payroll,
      after: updatedPayroll,
      source: 'USER',
    });

    return updatedPayroll ? this.mapToFullView(updatedPayroll) : null;
  }

  async remove(id: string) {
    const payroll = await this.payrollRepository.findById(id);

    const deletedCount = await this.payrollRepository.deleteDraftIf(id);

    if (deletedCount === 0) {
      const p = await this.payrollRepository.findById(id);
      if (!p) {
        throw new NotFoundException(
          `Payroll dengan ID '${id}' tidak ditemukan`,
        );
      }
      throw new ConflictException(
        `Hanya payroll dengan status DRAFT yang dapat dihapus, status saat ini: ${p.status}`,
      );
    }

    await this.auditLogService.record({
      action: 'DELETE',
      entity: 'Payroll',
      entityId: id,
      before: payroll,
      source: 'USER',
    });

    return {
      message: 'Payroll berhasil dihapus',
    };
  }

  async findAll(query: PayrollQueryDto, currentUser: AuthenticatedUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    let targetEmployeeId = query.employeeId;
    let targetDepartmentId = query.departmentId;

    // 1. Role: EMPLOYEE -> Hanya melihat data payroll milik sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (!currentUser.employeeId) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
      targetEmployeeId = currentUser.employeeId;
      targetDepartmentId = undefined;
    }

    // 2. Role: MANAGER -> Hanya melihat payroll karyawan di departemen yang sama
    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const managerEmployee = await this.payrollRepository.findEmployeeById(
        currentUser.employeeId,
      );
      if (!managerEmployee) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      targetDepartmentId = managerEmployee.departmentId;
    }

    // 3. Query database terpaginasi
    const [rawPayrolls, total] = await Promise.all([
      this.payrollRepository.findAll({
        skip,
        take: limit,
        employeeId: targetEmployeeId,
        departmentId: targetDepartmentId,
        status: query.status,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
      }),
      this.payrollRepository.countAll({
        employeeId: targetEmployeeId,
        departmentId: targetDepartmentId,
        status: query.status,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
      }),
    ]);

    // 4. Role-based view mapping
    const data = rawPayrolls.map((p) => {
      if (
        currentUser.role === UserRole.HR_ADMIN ||
        p.employeeId === currentUser.employeeId
      ) {
        return this.mapToFullView(p);
      }
      return this.mapToManagerView(p);
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string, currentUser: AuthenticatedUser) {
    const payroll = await this.payrollRepository.findById(id);
    if (!payroll) {
      throw new NotFoundException(`Payroll dengan ID '${id}' tidak ditemukan`);
    }

    // 1. Role: EMPLOYEE -> Hanya boleh melihat data dirinya sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== payroll.employeeId) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat data payroll Anda sendiri',
        );
      }
      return this.mapToFullView(payroll);
    }

    // 2. Role: MANAGER -> Hanya boleh melihat payroll karyawan di departemen yang sama
    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        throw new ForbiddenException(
          'Akun Manager tidak terhubung dengan data karyawan',
        );
      }

      const managerEmployee = await this.payrollRepository.findEmployeeById(
        currentUser.employeeId,
      );
      if (
        !managerEmployee ||
        managerEmployee.departmentId !== payroll.employee.departmentId
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat data payroll karyawan di departemen Anda',
        );
      }

      // Kepemilikan data pribadi didahulukan: jika milik Manager sendiri, kembalikan full view
      if (payroll.employeeId === currentUser.employeeId) {
        return this.mapToFullView(payroll);
      }

      return this.mapToManagerView(payroll);
    }

    // 3. Role: HR_ADMIN -> Akses penuh
    return this.mapToFullView(payroll);
  }
}
