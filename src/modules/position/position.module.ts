import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PositionRepository } from './position.repository';
import { PositionService } from './position.service';
import { PositionController } from './position.controller';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [PositionController],
  providers: [PositionRepository, PositionService],
  exports: [PositionService, PositionRepository],
})
export class PositionModule {}
