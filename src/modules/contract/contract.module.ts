import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ContractRepository } from './contract.repository';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [ContractController],
  providers: [ContractRepository, ContractService],
  exports: [ContractService, ContractRepository],
})
export class ContractModule {}
