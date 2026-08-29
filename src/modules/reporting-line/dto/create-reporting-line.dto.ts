import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateReportingLineDto {
  @IsUUID('4', { message: 'Manager ID harus berupa UUID valid' })
  @IsNotEmpty({ message: 'Manager ID wajib diisi' })
  managerId: string;

  @IsString()
  @IsNotEmpty({ message: 'Tanggal efektif mulai (effectiveFrom) wajib diisi' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggal effectiveFrom harus YYYY-MM-DD',
  })
  effectiveFrom: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
