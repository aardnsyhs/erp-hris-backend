import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ArchiveDepartmentDto {
  @ApiPropertyOptional({
    example: 'Restrukturisasi divisi Q3 2026',
    description: 'Alasan pengarsipan departemen',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(255, { message: 'Reason maksimal 255 karakter' })
  reason?: string;
}
