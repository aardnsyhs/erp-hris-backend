import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckOutDto {
  @ApiPropertyOptional({
    example: 'Selesai seluruh tiket sprint hari ini',
    description: 'Catatan tambahan saat check-out (maksimal 255 karakter)',
  })
  @IsOptional()
  @IsString({ message: 'Catatan (notes) harus berupa string' })
  @MaxLength(255, { message: 'Catatan (notes) maksimal 255 karakter' })
  notes?: string;
}
