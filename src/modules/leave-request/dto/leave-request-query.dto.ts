import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { LeaveRequestStatus, LeaveType } from '@prisma/client';

export class LeaveRequestQueryDto {
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
  @IsEnum(LeaveRequestStatus, {
    message: 'Status harus bernilai PENDING, APPROVED, atau REJECTED',
  })
  status?: LeaveRequestStatus;

  @IsOptional()
  @IsEnum(LeaveType, {
    message: 'Tipe cuti (leaveType) harus bernilai ANNUAL, SICK, UNPAID, atau MATERNITY',
  })
  leaveType?: LeaveType;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'startDate harus berupa tanggal yang valid' })
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'endDate harus berupa tanggal yang valid' })
  endDate?: Date;
}
