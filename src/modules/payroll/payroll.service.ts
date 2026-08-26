import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollStatus, Prisma } from '@prisma/client';
import { PayrollRepository } from './payroll.repository';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private readonly payrollRepository: PayrollRepository) {}

  private getTodayUtcDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  async create(dto: CreatePayrollDto) {
    // 1. Validasi rentang tanggal
    if (dto.periodEnd < dto.periodStart) {
      throw new BadRequestException(
        'Tanggal akhir periode (periodEnd) tidak boleh lebih awal dari tanggal mulai (periodStart)',
      );
    }

    // 2. Validasi keberadaan employee (dan tidak soft-deleted)
    const employee = await this.payrollRepository.findEmployeeById(dto.employeeId);
    if (!employee) {
      throw new BadRequestException(
        `Karyawan dengan ID '${dto.employeeId}' tidak valid atau tidak ditemukan`,
      );
    }

    // 3. Validasi duplikasi periode untuk karyawan yang sama
    const existingPayroll = await this.payrollRepository.findByEmployeeAndPeriod(
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
    return this.payrollRepository.create({
      employeeId: dto.employeeId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      basicSalary,
      allowances,
      deductions,
      netSalary,
      status: PayrollStatus.DRAFT,
    });
  }

  async process(id: string) {
    const updatedCount = await this.payrollRepository.updateStatusIf(
      id,
      PayrollStatus.DRAFT,
      PayrollStatus.PROCESSED,
    );

    if (updatedCount === 0) {
      const payroll = await this.payrollRepository.findById(id);
      if (!payroll) {
        throw new NotFoundException(`Payroll dengan ID '${id}' tidak ditemukan`);
      }
      throw new ConflictException(
        `Hanya payroll dengan status DRAFT yang dapat diproses, status saat ini: ${payroll.status}`,
      );
    }

    return this.payrollRepository.findById(id);
  }

  async pay(id: string) {
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
        throw new NotFoundException(`Payroll dengan ID '${id}' tidak ditemukan`);
      }
      throw new ConflictException(
        `Hanya payroll dengan status PROCESSED yang dapat dibayarkan, status saat ini: ${payroll.status}`,
      );
    }

    return this.payrollRepository.findById(id);
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

    return this.payrollRepository.findById(id);
  }

  async remove(id: string) {
    const deletedCount = await this.payrollRepository.deleteDraftIf(id);

    if (deletedCount === 0) {
      const payroll = await this.payrollRepository.findById(id);
      if (!payroll) {
        throw new NotFoundException(`Payroll dengan ID '${id}' tidak ditemukan`);
      }
      throw new ConflictException(
        `Hanya payroll dengan status DRAFT yang dapat dihapus, status saat ini: ${payroll.status}`,
      );
    }

    return {
      message: 'Payroll berhasil dihapus',
    };
  }
}
