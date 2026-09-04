import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ReparentDepartmentDto {
  @ApiProperty({
    description:
      'UUID departemen induk baru. Kirim null secara eksplisit untuk mempromosikan departemen menjadi Root node (Level 0).',
    example: '36cf2c07-3cba-41ca-807d-2720f3e9fef2',
    nullable: true,
  })
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID('4', {
    message: 'parentId harus berupa UUID format v4 yang valid atau null',
  })
  parentId: string | null;

  @ApiPropertyOptional({
    description:
      'Alasan perubahan posisi hierarki organisasi untuk pencatatan audit trail',
    example: 'Restrukturisasi divisi teknologi Q3 2026',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(255, { message: 'Reason maksimal 255 karakter' })
  reason?: string;
}
