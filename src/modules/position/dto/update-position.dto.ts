import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePositionDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt({ message: 'Level posisi harus berupa bilangan bulat' })
  @Min(1, { message: 'Level posisi minimal 1' })
  @IsOptional()
  level?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
