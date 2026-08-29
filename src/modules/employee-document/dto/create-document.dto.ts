import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsEnum(DocumentType, {
    message:
      'documentType harus salah satu dari: KTP, NPWP, BPJS_KES, BPJS_TK, IJAZAH, SERTIFIKAT, KONTRAK, LAINNYA',
  })
  documentType: DocumentType;

  @IsString({ message: 'Judul dokumen harus berupa teks' })
  @IsNotEmpty({ message: 'Judul dokumen wajib diisi' })
  @MaxLength(150, { message: 'Judul dokumen maksimal 150 karakter' })
  title: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'expiryDate harus berformat ISO 8601 (YYYY-MM-DD)' },
  )
  expiryDate?: string;
}
