import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class AuthRepository {
  // TODO: Inject PrismaService once database module is connected

  async findByEmail(email: string): Promise<User | null> {
    // TODO: Query User by email from Prisma
    return null;
  }

  async findById(id: string): Promise<User | null> {
    // TODO: Query User by id from Prisma
    return null;
  }

  async updateRefreshToken(userId: string, hashedRefreshToken: string | null): Promise<void> {
    // TODO: Store / rotate / invalidate hashed refresh token for the user
  }
}
