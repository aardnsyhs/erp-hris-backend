import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'User UUID',
  })
  id: string;

  @ApiProperty({ example: 'admin.hr@example.com', description: 'Email user' })
  email: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.HR_ADMIN,
    description: 'Role pengguna',
  })
  role: UserRole;

  @ApiProperty({ example: true, description: 'Status aktif akun' })
  isActive: boolean;

  @ApiPropertyOptional({
    example: 'b2c3d4e5-f678-90ab-cdef-1234567890ab',
    description: 'Employee UUID jika terhubung',
  })
  employeeId?: string | null;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Access Token',
  })
  accessToken: string;

  @ApiProperty({
    type: AuthUserDto,
    description: 'Informasi profil user yang login',
  })
  user: AuthUserDto;
}
