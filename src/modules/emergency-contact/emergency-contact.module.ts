import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EmergencyContactController } from './emergency-contact.controller';
import { EmergencyContactRepository } from './emergency-contact.repository';
import { EmergencyContactService } from './emergency-contact.service';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [EmergencyContactController],
  providers: [EmergencyContactService, EmergencyContactRepository],
  exports: [EmergencyContactService, EmergencyContactRepository],
})
export class EmergencyContactModule {}
