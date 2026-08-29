import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateEmergencyContactDto {
  @IsOptional()
  @IsString({ message: 'Nama kontak harus berupa teks' })
  @MaxLength(100, { message: 'Nama kontak maksimal 100 karakter' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Hubungan harus berupa teks' })
  @MaxLength(50, { message: 'Hubungan maksimal 50 karakter' })
  relationship?: string;

  @IsOptional()
  @IsString({ message: 'Nomor telepon harus berupa teks' })
  @MaxLength(30, { message: 'Nomor telepon maksimal 30 karakter' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(100, { message: 'Email maksimal 100 karakter' })
  email?: string;

  @IsOptional()
  @IsBoolean({ message: 'isPrimary harus bernilai boolean' })
  isPrimary?: boolean;
}
