import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class EmployeeQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Nomor halaman', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page harus berupa bilangan bulat' })
  @Min(1, { message: 'Page minimal bernilai 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Jumlah item per halaman (max 100)',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit harus berupa bilangan bulat' })
  @Min(1, { message: 'Limit minimal bernilai 1' })
  @Max(100, { message: 'Limit maksimal bernilai 100' })
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Budi',
    description: 'Kata kunci pencarian nama, NIP, email, atau jabatan',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa string' })
  search?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Filter berdasarkan departemen',
  })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId harus berupa UUID yang valid' })
  departmentId?: string;

  @ApiPropertyOptional({
    enum: EmployeeStatus,
    example: EmployeeStatus.ACTIVE,
    description: 'Filter berdasarkan status karyawan',
  })
  @IsOptional()
  @IsEnum(EmployeeStatus, {
    message: 'Status harus bernilai ACTIVE, INACTIVE, atau TERMINATED',
  })
  status?: EmployeeStatus;
}
