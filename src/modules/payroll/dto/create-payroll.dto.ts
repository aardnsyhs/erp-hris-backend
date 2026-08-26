import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreatePayrollDto {
  @IsUUID('4', { message: 'employeeId harus berupa UUID yang valid' })
  @IsNotEmpty({ message: 'employeeId tidak boleh kosong' })
  employeeId: string;

  @Type(() => Date)
  @IsDate({ message: 'Tanggal awal periode (periodStart) harus berupa tanggal yang valid' })
  @IsNotEmpty({ message: 'Tanggal awal periode (periodStart) tidak boleh kosong' })
  periodStart: Date;

  @Type(() => Date)
  @IsDate({ message: 'Tanggal akhir periode (periodEnd) harus berupa tanggal yang valid' })
  @IsNotEmpty({ message: 'Tanggal akhir periode (periodEnd) tidak boleh kosong' })
  periodEnd: Date;

  @IsOptional()
  @IsNumberString({}, { message: 'Tunjangan (allowances) harus berupa string angka desimal yang valid' })
  allowances?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Potongan (deductions) harus berupa string angka desimal yang valid' })
  deductions?: string;
}
