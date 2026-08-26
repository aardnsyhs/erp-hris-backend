import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckInDto {
  @ApiPropertyOptional({
    example: 'WFO - Kantor Pusat Lantai 3',
    description: 'Catatan tambahan saat check-in (maksimal 255 karakter)',
  })
  @IsOptional()
  @IsString({ message: 'Catatan (notes) harus berupa string' })
  @MaxLength(255, { message: 'Catatan (notes) maksimal 255 karakter' })
  notes?: string;
}
