import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePositionDto {
  @IsString()
  @IsNotEmpty({ message: 'Kode posisi tidak boleh kosong' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama/judul posisi tidak boleh kosong' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt({ message: 'Level posisi harus berupa bilangan bulat' })
  @Min(1, { message: 'Level posisi minimal 1' })
  level: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
