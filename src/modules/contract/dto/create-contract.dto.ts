import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ContractStatus, ContractType } from '@prisma/client';

export class CreateContractDto {
  @IsEnum(ContractType, { message: 'Tipe kontrak tidak valid' })
  @IsNotEmpty({ message: 'Tipe kontrak wajib diisi' })
  contractType: ContractType;

  @IsString()
  @IsNotEmpty({ message: 'Nomor kontrak wajib diisi' })
  contractNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Tanggal mulai kontrak (startDate) wajib diisi' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format startDate harus YYYY-MM-DD',
  })
  startDate: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format endDate harus YYYY-MM-DD',
  })
  endDate?: string;

  @IsEnum(ContractStatus, { message: 'Status kontrak tidak valid' })
  @IsOptional()
  status?: ContractStatus;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format renewalReminderDate harus YYYY-MM-DD',
  })
  renewalReminderDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID('4', { message: 'Document ID harus berupa UUID valid' })
  @IsOptional()
  documentId?: string;
}
