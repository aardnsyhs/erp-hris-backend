import { ContractStatus, ContractType } from '@prisma/client';

export class ContractResponseDto {
  id: string;
  employeeId: string;
  contractType: ContractType;
  contractNumber: string;
  startDate: Date;
  endDate?: Date | null;
  status: ContractStatus;
  renewalReminderDate?: Date | null;
  notes?: string | null;
  documentId?: string | null;
  document?: {
    id: string;
    title: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
