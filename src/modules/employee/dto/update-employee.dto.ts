import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID departemen baru',
  })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId harus berupa UUID yang valid' })
  departmentId?: string;

  @ApiPropertyOptional({
    example: 'EMP001',
    description: 'NIP baru (harus unik)',
  })
  @IsOptional()
  @IsString({ message: 'NIP harus berupa string' })
  @MinLength(3, { message: 'NIP minimal 3 karakter' })
  @MaxLength(30, { message: 'NIP maksimal 30 karakter' })
  nip?: string;

  @ApiPropertyOptional({
    example: 'Budi Santoso, S.Kom',
    description: 'Nama lengkap baru',
  })
  @IsOptional()
  @IsString({ message: 'Nama lengkap harus berupa string' })
  @MinLength(2, { message: 'Nama lengkap minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama lengkap maksimal 100 karakter' })
  fullName?: string;

  @ApiPropertyOptional({
    example: 'budi.new@example.com',
    description: 'Alamat email baru (harus unik)',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  email?: string;

  @ApiPropertyOptional({
    example: '+6281234567890',
    description: 'Nomor telepon baru format Indonesia',
  })
  @IsOptional()
  @IsString({ message: 'Nomor telepon harus berupa string' })
  @Matches(/^(\+62|62|0)[0-9]{8,13}$/, {
    message:
      'Format nomor telepon tidak valid untuk Indonesia (contoh: +628123456789 atau 08123456789, 9-14 digit)',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'Principal Software Engineer',
    description: 'Jabatan baru',
  })
  @IsOptional()
  @IsString({ message: 'Jabatan (jobTitle) harus berupa string' })
  @MinLength(2, { message: 'Jabatan minimal 2 karakter' })
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  jobTitle?: string;

  @ApiPropertyOptional({
    example: '2024-01-15T00:00:00.000Z',
    description: 'Tanggal hire date',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({
    message: 'Tanggal mulai bekerja (hireDate) harus berupa tanggal yang valid',
  })
  hireDate?: Date;

  @ApiPropertyOptional({
    example: '18000000',
    description: 'Gaji pokok baru (string angka desimal)',
  })
  @IsOptional()
  @IsNumberString(
    {},
    {
      message:
        'Gaji pokok (baseSalary) harus berupa string angka desimal yang valid',
    },
  )
  baseSalary?: string;

  @ApiPropertyOptional({
    enum: EmployeeStatus,
    example: EmployeeStatus.ACTIVE,
    description: 'Status baru karyawan (ACTIVE, INACTIVE, TERMINATED)',
  })
  @IsOptional()
  @IsEnum(EmployeeStatus, {
    message: 'Status harus bernilai ACTIVE, INACTIVE, atau TERMINATED',
  })
  status?: EmployeeStatus;
}
