import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType } from '@prisma/client';

export class DocumentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page harus berupa bilangan bulat' })
  @Min(1, { message: 'Page minimal bernilai 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit harus berupa bilangan bulat' })
  @Min(1, { message: 'Limit minimal bernilai 1' })
  @Max(100, { message: 'Limit maksimal bernilai 100' })
  limit?: number = 10;

  @IsOptional()
  @IsEnum(DocumentType, {
    message:
      'documentType harus salah satu dari: KTP, NPWP, BPJS_KES, BPJS_TK, IJAZAH, SERTIFIKAT, KONTRAK, LAINNYA',
  })
  documentType?: DocumentType;
}
