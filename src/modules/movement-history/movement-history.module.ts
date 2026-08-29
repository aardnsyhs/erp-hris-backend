import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MovementHistoryRepository } from './movement-history.repository';
import { MovementHistoryService } from './movement-history.service';
import { MovementHistoryController } from './movement-history.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MovementHistoryController],
  providers: [MovementHistoryRepository, MovementHistoryService],
  exports: [MovementHistoryService, MovementHistoryRepository],
})
export class MovementHistoryModule {}
