import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class DepartmentTreeQueryDto {
  @ApiPropertyOptional({
    example: false,
    description:
      'Sertakan departemen yang diarsipkan dalam pohon hierarki (default: false)',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') {
      return true;
    }
    if (value === 'false' || value === false || value === 0 || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean({ message: 'includeArchived harus berupa boolean' })
  includeArchived?: boolean = false;
}
