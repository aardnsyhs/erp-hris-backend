import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class HrBriefQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-02',
    description: 'Calendar date in WIB; maximum inclusive range: 90 days',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-08',
    description: 'Defaults to today in Asia/Jakarta',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @ApiPropertyOptional({ description: 'Exact employee department UUID' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;
}
