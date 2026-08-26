import { UserRole } from '@prisma/client';

export class AuthUserDto {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  employeeId?: string | null;
}

export class AuthResponseDto {
  // TODO: Return access token for in-memory frontend storage
  accessToken: string;

  // TODO: Return sanitized user profile info (never include passwordHash)
  user: AuthUserDto;
}
