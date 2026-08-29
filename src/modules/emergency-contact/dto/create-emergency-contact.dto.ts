import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEmergencyContactDto {
  @IsString({ message: 'Nama kontak harus berupa teks' })
  @IsNotEmpty({ message: 'Nama kontak wajib diisi' })
  @MaxLength(100, { message: 'Nama kontak maksimal 100 karakter' })
  name: string;

  @IsString({ message: 'Hubungan harus berupa teks' })
  @IsNotEmpty({ message: 'Hubungan wajib diisi' })
  @MaxLength(50, { message: 'Hubungan maksimal 50 karakter' })
  relationship: string;

  @IsString({ message: 'Nomor telepon harus berupa teks' })
  @IsNotEmpty({ message: 'Nomor telepon wajib diisi' })
  @MaxLength(30, { message: 'Nomor telepon maksimal 30 karakter' })
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(100, { message: 'Email maksimal 100 karakter' })
  email?: string;

  @IsOptional()
  @IsBoolean({ message: 'isPrimary harus bernilai boolean' })
  isPrimary?: boolean;
}
