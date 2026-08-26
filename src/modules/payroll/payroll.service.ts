import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PayrollStatus, Prisma } from '@prisma/client';
import { PayrollRepository } from './payroll.repository';
import { CreatePayrollDto } from './dto/create-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private readonly payrollRepository: PayrollRepository) {}

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
}
