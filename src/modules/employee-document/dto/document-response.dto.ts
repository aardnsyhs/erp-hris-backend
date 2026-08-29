import { DocumentType, ScanStatus } from '@prisma/client';

export class DocumentResponseDto {
  id: string;
  employeeId: string;
  documentType: DocumentType;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  scanStatus: ScanStatus;
  expiryDate: Date | null;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
}
