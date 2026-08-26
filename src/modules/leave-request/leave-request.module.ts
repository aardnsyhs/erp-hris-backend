import { Module } from '@nestjs/common';
import { LeaveRequestController } from './leave-request.controller';
import { LeaveRequestService } from './leave-request.service';
import { LeaveRequestRepository } from './leave-request.repository';

@Module({
  controllers: [LeaveRequestController],
  providers: [LeaveRequestService, LeaveRequestRepository],
  exports: [LeaveRequestService, LeaveRequestRepository],
})
export class LeaveRequestModule {}
