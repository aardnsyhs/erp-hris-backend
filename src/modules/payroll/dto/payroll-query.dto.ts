import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PayrollStatus } from '@prisma/client';

export class PayrollQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Nomor halaman', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page harus berupa bilangan bulat' })
  @Min(1, { message: 'Page minimal bernilai 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Jumlah item per halaman',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit harus berupa bilangan bulat' })
  @Min(1, { message: 'Limit minimal bernilai 1' })
  @Max(100, { message: 'Limit maksimal bernilai 100' })
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Filter ID Karyawan (HR_ADMIN only)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'employeeId harus berupa UUID yang valid' })
  employeeId?: string;

  @ApiPropertyOptional({
    example: 'b2c3d4e5-f678-90ab-cdef-1234567890ab',
    description: 'Filter ID Departemen',
  })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId harus berupa UUID yang valid' })
  departmentId?: string;

  @ApiPropertyOptional({
    enum: PayrollStatus,
    example: PayrollStatus.DRAFT,
    description: 'Filter status payroll (DRAFT, PROCESSED, PAID)',
  })
  @IsOptional()
  @IsEnum(PayrollStatus, {
    message: 'Status harus bernilai DRAFT, PROCESSED, atau PAID',
  })
  status?: PayrollStatus;

  @ApiPropertyOptional({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Filter tanggal awal periode',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'periodStart harus berupa tanggal yang valid' })
  periodStart?: Date;

  @ApiPropertyOptional({
    example: '2026-08-31T00:00:00.000Z',
    description: 'Filter tanggal akhir periode',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'periodEnd harus berupa tanggal yang valid' })
  periodEnd?: Date;
}
