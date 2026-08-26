import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreatePayrollDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID karyawan penerima gaji',
  })
  @IsUUID('4', { message: 'employeeId harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'employeeId tidak boleh kosong' })
  employeeId: string;

  @ApiProperty({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Tanggal awal periode payroll',
  })
  @Type(() => Date)
  @IsDate({
    message:
      'Tanggal awal periode (periodStart) harus berupa tanggal yang valid',
  })
  @IsNotEmpty({
    message: 'Tanggal awal periode (periodStart) tidak boleh kosong',
  })
  periodStart: Date;

  @ApiProperty({
    example: '2026-08-31T00:00:00.000Z',
    description: 'Tanggal akhir periode payroll (harus >= periodStart)',
  })
  @Type(() => Date)
  @IsDate({
    message:
      'Tanggal akhir periode (periodEnd) harus berupa tanggal yang valid',
  })
  @IsNotEmpty({
    message: 'Tanggal akhir periode (periodEnd) tidak boleh kosong',
  })
  periodEnd: Date;

  @ApiPropertyOptional({
    example: '2500000',
    description:
      'Total tunjangan (allowances) dalam string angka desimal (default: 0)',
    default: '0',
  })
  @IsOptional()
  @IsNumberString(
    {},
    {
      message:
        'Tunjangan (allowances) harus berupa string angka desimal yang valid',
    },
  )
  allowances?: string;

  @ApiPropertyOptional({
    example: '500000',
    description:
      'Total potongan (deductions) dalam string angka desimal (default: 0)',
    default: '0',
  })
  @IsOptional()
  @IsNumberString(
    {},
    {
      message:
        'Potongan (deductions) harus berupa string angka desimal yang valid',
    },
  )
  deductions?: string;
}
