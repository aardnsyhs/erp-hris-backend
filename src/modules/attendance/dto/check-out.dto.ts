import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckOutDto {
  @IsOptional()
  @IsString({ message: 'Catatan (notes) harus berupa string' })
  @MaxLength(255, { message: 'Catatan (notes) maksimal 255 karakter' })
  notes?: string;
}
