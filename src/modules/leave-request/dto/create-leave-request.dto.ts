import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateLeaveRequestDto {
  @IsEnum(LeaveType, {
    message: 'Tipe cuti (leaveType) harus bernilai ANNUAL, SICK, UNPAID, atau MATERNITY',
  })
  @IsNotEmpty({ message: 'Tipe cuti (leaveType) tidak boleh kosong' })
  leaveType: LeaveType;

  @Type(() => Date)
  @IsDate({ message: 'Tanggal mulai (startDate) harus berupa tanggal yang valid' })
  @IsNotEmpty({ message: 'Tanggal mulai (startDate) tidak boleh kosong' })
  startDate: Date;

  @Type(() => Date)
  @IsDate({ message: 'Tanggal selesai (endDate) harus berupa tanggal yang valid' })
  @IsNotEmpty({ message: 'Tanggal selesai (endDate) tidak boleh kosong' })
  endDate: Date;

  @IsString({ message: 'Alasan cuti (reason) harus berupa string' })
  @IsNotEmpty({ message: 'Alasan cuti (reason) wajib diisi' })
  @MaxLength(500, { message: 'Alasan cuti (reason) maksimal 500 karakter' })
  reason: string;
}
