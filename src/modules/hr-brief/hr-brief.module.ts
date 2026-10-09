import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HrBriefController } from './hr-brief.controller';
import { HrBriefRepository } from './hr-brief.repository';
import { HrBriefService } from './hr-brief.service';

@Module({
  imports: [PrismaModule],
  controllers: [HrBriefController],
  providers: [HrBriefRepository, HrBriefService],
})
export class HrBriefModule {}
