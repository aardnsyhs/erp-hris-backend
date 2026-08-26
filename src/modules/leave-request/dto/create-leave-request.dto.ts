import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateLeaveRequestDto {
  @ApiProperty({
    enum: LeaveType,
    example: LeaveType.ANNUAL,
    description: 'Tipe cuti (ANNUAL, SICK, UNPAID, MATERNITY)',
  })
  @IsEnum(LeaveType, {
    message:
      'Tipe cuti (leaveType) harus bernilai ANNUAL, SICK, UNPAID, atau MATERNITY',
  })
  @IsNotEmpty({ message: 'Tipe cuti (leaveType) tidak boleh kosong' })
  leaveType: LeaveType;

  @ApiProperty({
    example: '2026-09-01T00:00:00.000Z',
    description: 'Tanggal mulai cuti',
  })
  @Type(() => Date)
  @IsDate({
    message: 'Tanggal mulai (startDate) harus berupa tanggal yang valid',
  })
  @IsNotEmpty({ message: 'Tanggal mulai (startDate) tidak boleh kosong' })
  startDate: Date;

  @ApiProperty({
    example: '2026-09-03T00:00:00.000Z',
    description: 'Tanggal akhir cuti (harus >= startDate)',
  })
  @Type(() => Date)
  @IsDate({
    message: 'Tanggal selesai (endDate) harus berupa tanggal yang valid',
  })
  @IsNotEmpty({ message: 'Tanggal selesai (endDate) tidak boleh kosong' })
  endDate: Date;

  @ApiProperty({
    example: 'Liburan keluarga tahunan ke luar kota',
    description: 'Alasan pengajuan cuti (wajib diisi, maksimal 500 karakter)',
  })
  @IsString({ message: 'Alasan cuti (reason) harus berupa string' })
  @IsNotEmpty({ message: 'Alasan cuti (reason) wajib diisi' })
  @MaxLength(500, { message: 'Alasan cuti (reason) maksimal 500 karakter' })
  reason: string;
}
