import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({
    example: 'ENG',
    description: 'Kode unik departemen baru (2-20 karakter)',
  })
  @IsOptional()
  @IsString({ message: 'Kode departemen harus berupa string' })
  @MinLength(2, { message: 'Kode departemen minimal 2 karakter' })
  @MaxLength(20, { message: 'Kode departemen maksimal 20 karakter' })
  code?: string;

  @ApiPropertyOptional({
    example: 'Software Engineering',
    description: 'Nama departemen baru (2-100 karakter)',
  })
  @IsOptional()
  @IsString({ message: 'Nama departemen harus berupa string' })
  @MinLength(2, { message: 'Nama departemen minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama departemen maksimal 100 karakter' })
  name?: string;
}
