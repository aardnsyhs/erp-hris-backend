import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmployeeStatus, UserRole } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({
    enum: UserRole,
    example: UserRole.EMPLOYEE,
    description: 'Role akses akun login karyawan (HR_ADMIN, MANAGER, EMPLOYEE)',
  })
  @IsEnum(UserRole, {
    message: 'Role harus bernilai HR_ADMIN, MANAGER, atau EMPLOYEE',
  })
  @IsNotEmpty({ message: 'Role akun karyawan tidak boleh kosong' })
  role: UserRole;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID departemen tempat karyawan bekerja',
  })
  @IsUUID('4', { message: 'departmentId harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'departmentId tidak boleh kosong' })
  departmentId: string;

  @ApiProperty({
    example: 'EMP001',
    description: 'Nomor Induk Pegawai (NIP) unik (3-30 karakter)',
  })
  @IsString({ message: 'NIP harus berupa string' })
  @IsNotEmpty({ message: 'NIP tidak boleh kosong' })
  @MinLength(3, { message: 'NIP minimal 3 karakter' })
  @MaxLength(30, { message: 'NIP maksimal 30 karakter' })
  nip: string;

  @ApiProperty({
    example: 'Budi Santoso',
    description: 'Nama lengkap karyawan (2-100 karakter)',
  })
  @IsString({ message: 'Nama lengkap harus berupa string' })
  @IsNotEmpty({ message: 'Nama lengkap tidak boleh kosong' })
  @MinLength(2, { message: 'Nama lengkap minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama lengkap maksimal 100 karakter' })
  fullName: string;

  @ApiProperty({
    example: 'budi.santoso@example.com',
    description: 'Alamat email unik karyawan',
  })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email: string;

  @ApiPropertyOptional({
    example: '+6281234567890',
    description: 'Nomor telepon format Indonesia (+62 / 62 / 08...)',
  })
  @IsOptional()
  @IsString({ message: 'Nomor telepon harus berupa string' })
  @Matches(/^(\+62|62|0)[0-9]{8,13}$/, {
    message:
      'Format nomor telepon tidak valid untuk Indonesia (contoh: +628123456789 atau 08123456789, 9-14 digit)',
  })
  phone?: string;

  @ApiProperty({
    example: 'Senior Software Engineer',
    description: 'Jabatan karyawan',
  })
  @IsString({ message: 'Jabatan (jobTitle) harus berupa string' })
  @IsNotEmpty({ message: 'Jabatan (jobTitle) tidak boleh kosong' })
  @MinLength(2, { message: 'Jabatan minimal 2 karakter' })
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  jobTitle: string;

  @ApiProperty({
    example: '2024-01-15T00:00:00.000Z',
    description: 'Tanggal mulai bekerja (hire date)',
  })
  @Type(() => Date)
  @IsDate({
    message: 'Tanggal mulai bekerja (hireDate) harus berupa tanggal yang valid',
  })
  @IsNotEmpty({
    message: 'Tanggal mulai bekerja (hireDate) tidak boleh kosong',
  })
  hireDate: Date;

  @ApiProperty({
    example: '15000000',
    description: 'Gaji pokok per bulan dalam format string angka desimal',
  })
  @IsNotEmpty({ message: 'Gaji pokok (baseSalary) tidak boleh kosong' })
  @IsNumberString(
    {},
    {
      message:
        'Gaji pokok (baseSalary) harus berupa string angka desimal yang valid',
    },
  )
  baseSalary: string;

  @ApiPropertyOptional({
    enum: EmployeeStatus,
    example: EmployeeStatus.ACTIVE,
    description: 'Status kepegawaian (ACTIVE, INACTIVE, TERMINATED)',
    default: EmployeeStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EmployeeStatus, {
    message: 'Status harus bernilai ACTIVE, INACTIVE, atau TERMINATED',
  })
  status?: EmployeeStatus = EmployeeStatus.ACTIVE;
}
