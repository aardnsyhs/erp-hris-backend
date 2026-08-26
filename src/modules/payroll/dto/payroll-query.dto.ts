import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PayrollStatus } from '@prisma/client';

export class PayrollQueryDto {
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
  @IsUUID('4', { message: 'employeeId harus berupa UUID yang valid' })
  employeeId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'departmentId harus berupa UUID yang valid' })
  departmentId?: string;

  @IsOptional()
  @IsEnum(PayrollStatus, {
    message: 'Status harus bernilai DRAFT, PROCESSED, atau PAID',
  })
  status?: PayrollStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'periodStart harus berupa tanggal yang valid' })
  periodStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'periodEnd harus berupa tanggal yang valid' })
  periodEnd?: Date;
}
