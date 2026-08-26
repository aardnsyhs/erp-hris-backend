import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayrollStatus, Prisma } from '@prisma/client';

export class DepartmentMiniDto {
  @ApiProperty({ example: 'dept-eng-uuid', description: 'UUID departemen' })
  id: string;

  @ApiProperty({ example: 'ENG', description: 'Kode departemen' })
  code: string;

  @ApiProperty({ example: 'Engineering', description: 'Nama departemen' })
  name: string;
}

export class EmployeeSummaryDto {
  @ApiProperty({ example: 'emp-uuid-1', description: 'UUID karyawan' })
  id: string;

  @ApiProperty({ example: 'EMP001', description: 'NIP karyawan' })
  nip: string;

  @ApiProperty({ example: 'John Doe', description: 'Nama lengkap karyawan' })
  fullName: string;

  @ApiProperty({
    example: 'Senior Software Engineer',
    description: 'Jabatan karyawan',
  })
  jobTitle: string;

  @ApiPropertyOptional({
    type: DepartmentMiniDto,
    description: 'Data departemen karyawan',
  })
  department?: DepartmentMiniDto | null;
}

export class PayrollResponseDto {
  @ApiProperty({ example: 'payroll-uuid-1', description: 'UUID payroll' })
  id: string;

  @ApiProperty({ example: 'emp-uuid-1', description: 'UUID karyawan penerima' })
  employeeId: string;

  @ApiPropertyOptional({
    type: EmployeeSummaryDto,
    description: 'Ringkasan data karyawan',
  })
  employee?: EmployeeSummaryDto | null;

  @ApiProperty({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Awal periode payroll',
  })
  periodStart: Date;

  @ApiProperty({
    example: '2026-08-31T00:00:00.000Z',
    description: 'Akhir periode payroll',
  })
  periodEnd: Date;

  @ApiProperty({
    example: '10000000',
    description: 'Gaji pokok yang di-snapshot saat generate (Decimal)',
  })
  basicSalary: Prisma.Decimal;

  @ApiProperty({ example: '2000000', description: 'Total tunjangan (Decimal)' })
  allowances: Prisma.Decimal;

  @ApiProperty({ example: '500000', description: 'Total potongan (Decimal)' })
  deductions: Prisma.Decimal;

  @ApiProperty({
    example: '11500000',
    description: 'Gaji bersih (basicSalary + allowances - deductions)',
  })
  netSalary: Prisma.Decimal;

  @ApiProperty({
    enum: PayrollStatus,
    example: PayrollStatus.DRAFT,
    description: 'Status payroll (DRAFT, PROCESSED, PAID)',
  })
  status: PayrollStatus;

  @ApiPropertyOptional({
    example: '2026-08-28T00:00:00.000Z',
    description: 'Tanggal pembayaran (hanya terisi saat status PAID)',
  })
  paymentDate: Date | null;

  @ApiProperty({
    example: '2026-08-26T00:00:00.000Z',
    description: 'Waktu pembuatan',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-08-26T00:00:00.000Z',
    description: 'Waktu pembaruan terakhir',
  })
  updatedAt: Date;
}

export class PayrollManagerViewDto {
  @ApiProperty({ example: 'payroll-uuid-1', description: 'UUID payroll' })
  id: string;

  @ApiProperty({ example: 'emp-uuid-1', description: 'UUID karyawan penerima' })
  employeeId: string;

  @ApiPropertyOptional({
    type: EmployeeSummaryDto,
    description: 'Ringkasan data karyawan',
  })
  employee?: EmployeeSummaryDto | null;

  @ApiProperty({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Awal periode payroll',
  })
  periodStart: Date;

  @ApiProperty({
    example: '2026-08-31T00:00:00.000Z',
    description: 'Akhir periode payroll',
  })
  periodEnd: Date;

  @ApiProperty({
    enum: PayrollStatus,
    example: PayrollStatus.DRAFT,
    description: 'Status payroll (DRAFT, PROCESSED, PAID)',
  })
  status: PayrollStatus;

  @ApiPropertyOptional({
    example: '2026-08-28T00:00:00.000Z',
    description: 'Tanggal pembayaran (hanya terisi saat status PAID)',
  })
  paymentDate: Date | null;

  @ApiProperty({
    example: '2026-08-26T00:00:00.000Z',
    description: 'Waktu pembuatan',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-08-26T00:00:00.000Z',
    description: 'Waktu pembaruan terakhir',
  })
  updatedAt: Date;
}
