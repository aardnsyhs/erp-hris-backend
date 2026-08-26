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
  @IsOptional()
  @IsUUID('4', { message: 'departmentId harus berupa UUID yang valid' })
  departmentId?: string;

  @IsOptional()
  @IsString({ message: 'NIP harus berupa string' })
  @MinLength(3, { message: 'NIP minimal 3 karakter' })
  @MaxLength(30, { message: 'NIP maksimal 30 karakter' })
  nip?: string;

  @IsOptional()
  @IsString({ message: 'Nama lengkap harus berupa string' })
  @MinLength(2, { message: 'Nama lengkap minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama lengkap maksimal 100 karakter' })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Nomor telepon harus berupa string' })
  @Matches(/^(\+62|62|0)[0-9]{8,13}$/, {
    message: 'Format nomor telepon tidak valid untuk Indonesia (contoh: +628123456789 atau 08123456789, 9-14 digit)',
  })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Jabatan (jobTitle) harus berupa string' })
  @MinLength(2, { message: 'Jabatan minimal 2 karakter' })
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  jobTitle?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Tanggal mulai bekerja (hireDate) harus berupa tanggal yang valid' })
  hireDate?: Date;

  @IsOptional()
  @IsNumberString({}, { message: 'Gaji pokok (baseSalary) harus berupa string angka desimal yang valid' })
  baseSalary?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus, { message: 'Status harus bernilai ACTIVE, INACTIVE, atau TERMINATED' })
  status?: EmployeeStatus;
}
