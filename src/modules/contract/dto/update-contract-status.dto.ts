import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ContractStatus } from '@prisma/client';

export class UpdateContractStatusDto {
  @IsEnum(ContractStatus, { message: 'Status kontrak tidak valid' })
  @IsNotEmpty({ message: 'Status kontrak baru wajib diisi' })
  status: ContractStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
