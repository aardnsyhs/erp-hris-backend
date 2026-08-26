import { Injectable } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async validateUser(email: string, pass: string): Promise<any> {
    // TODO: 1. Fetch user by email from AuthRepository
    // TODO: 2. Check if user exists and is active (isActive == true)
    // TODO: 3. Compare password with passwordHash using bcrypt.compare
    return null;
  }

  async login(loginDto: LoginDto): Promise<{ authResponse: AuthResponseDto; refreshToken: string }> {
    // TODO: 1. Validate user credentials
    // TODO: 2. Generate short-lived Access Token (10-15m)
    // TODO: 3. Generate Refresh Token (7d)
    // TODO: 4. Hash refresh token and store in database
    // TODO: 5. Return accessToken + user profile and refreshToken for cookie delivery
    throw new Error('Not implemented');
  }

  async refreshTokens(userId: string, incomingRefreshToken: string): Promise<{ accessToken: string; newRefreshToken: string }> {
    // TODO: 1. Fetch user from repository
    // TODO: 2. Verify incomingRefreshToken matches hashed token in DB
    // TODO: 3. Implement reuse detection (revoke session family if mismatch/already used)
    // TODO: 4. Issue new access token and rotated refresh token
    // TODO: 5. Store updated hashed refresh token in DB
    throw new Error('Not implemented');
  }

  async logout(userId: string): Promise<void> {
    // TODO: Invalidate / clear refresh token hash in database
  }

  async getMe(userId: string): Promise<any> {
    // TODO: Fetch user profile (omitting passwordHash) with linked Employee data
    throw new Error('Not implemented');
  }
}
