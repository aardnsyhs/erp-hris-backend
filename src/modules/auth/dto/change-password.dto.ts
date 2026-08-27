import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Password saat ini yang masih aktif',
    example: 'password123',
  })
  @IsString({ message: 'Password saat ini harus berupa teks' })
  @IsNotEmpty({ message: 'Password saat ini wajib diisi' })
  currentPassword: string;

  @ApiProperty({
    description: 'Password baru (minimal 8 karakter)',
    example: 'newPassword123',
    minLength: 8,
  })
  @IsString({ message: 'Password baru harus berupa teks' })
  @MinLength(8, { message: 'Password baru minimal 8 karakter' })
  newPassword: string;
}
