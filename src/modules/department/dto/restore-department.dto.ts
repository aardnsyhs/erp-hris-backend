import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RestoreDepartmentDto {
  @ApiPropertyOptional({
    example: 'Reaktivasi departemen untuk inisiatif baru',
    description: 'Alasan pengaktifan kembali departemen',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(255, { message: 'Reason maksimal 255 karakter' })
  reason?: string;
}
