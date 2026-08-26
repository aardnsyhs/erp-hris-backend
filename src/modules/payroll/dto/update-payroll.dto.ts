import { IsNumberString, IsOptional } from 'class-validator';

export class UpdatePayrollDto {
  @IsOptional()
  @IsNumberString({}, { message: 'Tunjangan (allowances) harus berupa string angka desimal yang valid' })
  allowances?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Potongan (deductions) harus berupa string angka desimal yang valid' })
  deductions?: string;
}
