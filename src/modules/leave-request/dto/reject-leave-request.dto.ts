import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectLeaveRequestDto {
  @IsString({ message: 'Alasan penolakan (rejectionReason) harus berupa string' })
  @IsNotEmpty({ message: 'Alasan penolakan (rejectionReason) wajib diisi' })
  @MaxLength(500, { message: 'Alasan penolakan (rejectionReason) maksimal 500 karakter' })
  rejectionReason: string;
}
