import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional } from 'class-validator';

export class UpdatePayrollDto {
  @ApiPropertyOptional({
    example: '3000000',
    description: 'Tunjangan baru dalam string angka desimal',
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
    example: '750000',
    description: 'Potongan baru dalam string angka desimal',
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
