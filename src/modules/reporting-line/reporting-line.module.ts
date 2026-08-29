import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ReportingLineRepository } from './reporting-line.repository';
import { ReportingLineService } from './reporting-line.service';
import { ReportingLineController } from './reporting-line.controller';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [ReportingLineController],
  providers: [ReportingLineRepository, ReportingLineService],
  exports: [ReportingLineService, ReportingLineRepository],
})
export class ReportingLineModule {}
