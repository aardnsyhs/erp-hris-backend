import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectLeaveRequestDto {
  @ApiProperty({
    example: 'Kekurangan kapasitas tim pada sprint aktif saat ini',
    description:
      'Alasan penolakan permohonan cuti (wajib diisi, maksimal 500 karakter)',
  })
  @IsString({
    message: 'Alasan penolakan (rejectionReason) harus berupa string',
  })
  @IsNotEmpty({ message: 'Alasan penolakan (rejectionReason) wajib diisi' })
  @MaxLength(500, {
    message: 'Alasan penolakan (rejectionReason) maksimal 500 karakter',
  })
  rejectionReason: string;
}
