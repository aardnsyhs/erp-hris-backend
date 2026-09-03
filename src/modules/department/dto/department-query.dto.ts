import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum DepartmentStatusFilter {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  ALL = 'ALL',
}

export class DepartmentQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Nomor halaman (default: 1)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page harus berupa bilangan bulat' })
  @Min(1, { message: 'Page minimal bernilai 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Jumlah item per halaman (default: 10, max: 100)',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit harus berupa bilangan bulat' })
  @Min(1, { message: 'Limit minimal bernilai 1' })
  @Max(100, { message: 'Limit maksimal bernilai 100' })
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Engineering',
    description: 'Kata kunci pencarian nama atau kode departemen',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa string' })
  search?: string;

  @ApiPropertyOptional({
    enum: DepartmentStatusFilter,
    example: DepartmentStatusFilter.ACTIVE,
    description:
      'Filter status departemen: ACTIVE, ARCHIVED, atau ALL (default: ACTIVE)',
    default: DepartmentStatusFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(DepartmentStatusFilter, {
    message: 'Status harus salah satu dari: ACTIVE, ARCHIVED, ALL',
  })
  status?: DepartmentStatusFilter = DepartmentStatusFilter.ACTIVE;
}

export { DepartmentQueryDto as PaginationQueryDto };
