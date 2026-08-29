import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { AssignmentType } from '@prisma/client';

export class CreatePositionAssignmentDto {
  @IsUUID('4', { message: 'Position ID harus berupa UUID valid' })
  @IsNotEmpty({ message: 'Position ID wajib diisi' })
  positionId: string;

  @IsUUID('4', { message: 'Department ID harus berupa UUID valid' })
  @IsNotEmpty({ message: 'Department ID wajib diisi' })
  departmentId: string;

  @IsString()
  @IsNotEmpty({ message: 'Tanggal efektif mulai (effectiveFrom) wajib diisi' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggal effectiveFrom harus YYYY-MM-DD',
  })
  effectiveFrom: string;

  @IsEnum(AssignmentType, { message: 'Tipe penugasan tidak valid' })
  @IsNotEmpty({ message: 'Tipe penugasan wajib diisi' })
  assignmentType: AssignmentType;

  @IsString()
  @IsOptional()
  notes?: string;
}
