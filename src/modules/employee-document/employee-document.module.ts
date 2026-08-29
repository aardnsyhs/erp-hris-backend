import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EmployeeDocumentController } from './employee-document.controller';
import { EmployeeDocumentRepository } from './employee-document.repository';
import { EmployeeDocumentService } from './employee-document.service';

@Module({
  imports: [PrismaModule, StorageModule, AuditLogModule],
  controllers: [EmployeeDocumentController],
  providers: [EmployeeDocumentService, EmployeeDocumentRepository],
  exports: [EmployeeDocumentService, EmployeeDocumentRepository],
})
export class EmployeeDocumentModule {}
