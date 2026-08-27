import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateWorkScheduleDto {
  @ApiPropertyOptional({
    example: '09:00',
    description: 'Jam mulai kerja dalam format "HH:mm" (WIB / Asia/Jakarta)',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime harus berupa string format "HH:mm" (contoh: "09:00")',
  })
  startTime?: string;

  @ApiPropertyOptional({
    example: 15,
    description: 'Toleransi keterlambatan dalam menit (minimal 0)',
  })
  @IsOptional()
  @IsInt({ message: 'lateToleranceMinutes harus berupa bilangan bulat' })
  @Min(0, { message: 'lateToleranceMinutes minimal bernilai 0 menit' })
  lateToleranceMinutes?: number;

  @ApiPropertyOptional({
    example: 480,
    description: 'Total menit kerja standar per hari (contoh: 480 = 8 jam)',
  })
  @IsOptional()
  @IsInt({ message: 'standardWorkMinutes harus berupa bilangan bulat' })
  @Min(60, { message: 'standardWorkMinutes minimal 60 menit (1 jam)' })
  @Max(1440, { message: 'standardWorkMinutes maksimal 1440 menit (24 jam)' })
  standardWorkMinutes?: number;
}
