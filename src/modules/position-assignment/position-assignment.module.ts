import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MovementHistoryModule } from '../movement-history/movement-history.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PositionAssignmentRepository } from './position-assignment.repository';
import { PositionAssignmentService } from './position-assignment.service';
import { PositionAssignmentController } from './position-assignment.controller';

@Module({
  imports: [PrismaModule, MovementHistoryModule, AuditLogModule],
  controllers: [PositionAssignmentController],
  providers: [PositionAssignmentRepository, PositionAssignmentService],
  exports: [PositionAssignmentService, PositionAssignmentRepository],
})
export class PositionAssignmentModule {}
