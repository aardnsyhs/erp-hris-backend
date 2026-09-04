import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'ENG',
    description: 'Kode unik departemen (2-20 karakter)',
  })
  @IsString({ message: 'Kode departemen harus berupa string' })
  @IsNotEmpty({ message: 'Kode departemen tidak boleh kosong' })
  @MinLength(2, { message: 'Kode departemen minimal 2 karakter' })
  @MaxLength(20, { message: 'Kode departemen maksimal 20 karakter' })
  code: string;

  @ApiProperty({
    example: 'Engineering',
    description: 'Nama departemen (2-100 karakter)',
  })
  @IsString({ message: 'Nama departemen harus berupa string' })
  @IsNotEmpty({ message: 'Nama departemen tidak boleh kosong' })
  @MinLength(2, { message: 'Nama departemen minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama departemen maksimal 100 karakter' })
  name: string;

  @ApiPropertyOptional({
    example: 'c1d95c0e-319f-4b87-bbc2-d550ecf3fa29',
    description:
      'UUID departemen induk (opsional, jika tidak diisi departemen menjadi root node)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parentId harus berupa UUID v4 yang valid' })
  parentId?: string;
}
