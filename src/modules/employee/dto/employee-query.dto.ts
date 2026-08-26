import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class EmployeeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page harus berupa bilangan bulat' })
  @Min(1, { message: 'Page minimal bernilai 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit harus berupa bilangan bulat' })
  @Min(1, { message: 'Limit minimal bernilai 1' })
  @Max(100, { message: 'Limit maksimal bernilai 100' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'Search harus berupa string' })
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'departmentId harus berupa UUID yang valid' })
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus, { message: 'Status harus bernilai ACTIVE, INACTIVE, atau TERMINATED' })
  status?: EmployeeStatus;
}
