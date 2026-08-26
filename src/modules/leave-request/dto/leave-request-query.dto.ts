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
import { LeaveRequestStatus, LeaveType } from '@prisma/client';

export class LeaveRequestQueryDto {
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
    enum: LeaveRequestStatus,
    example: LeaveRequestStatus.PENDING,
    description: 'Filter status cuti (PENDING, APPROVED, REJECTED)',
  })
  @IsOptional()
  @IsEnum(LeaveRequestStatus, {
    message: 'Status harus bernilai PENDING, APPROVED, atau REJECTED',
  })
  status?: LeaveRequestStatus;

  @ApiPropertyOptional({
    enum: LeaveType,
    example: LeaveType.ANNUAL,
    description: 'Filter tipe cuti (ANNUAL, SICK, UNPAID, MATERNITY)',
  })
  @IsOptional()
  @IsEnum(LeaveType, {
    message:
      'Tipe cuti (leaveType) harus bernilai ANNUAL, SICK, UNPAID, atau MATERNITY',
  })
  leaveType?: LeaveType;

  @ApiPropertyOptional({
    example: '2026-09-01T00:00:00.000Z',
    description: 'Filter tanggal awal',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'startDate harus berupa tanggal yang valid' })
  startDate?: Date;

  @ApiPropertyOptional({
    example: '2026-09-30T00:00:00.000Z',
    description: 'Filter tanggal akhir',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'endDate harus berupa tanggal yang valid' })
  endDate?: Date;
}
