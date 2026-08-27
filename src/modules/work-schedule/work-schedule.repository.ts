import { Injectable } from '@nestjs/common';
import { WorkSchedule } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_WORK_SCHEDULE,
  DEFAULT_WORK_SCHEDULE_ID,
} from './work-schedule.constants';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';

@Injectable()
export class WorkScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(): Promise<WorkSchedule> {
    const existing = await this.prisma.workSchedule.findUnique({
      where: { id: DEFAULT_WORK_SCHEDULE_ID },
    });

    if (existing) {
      return existing;
    }

    // Fallback self-healing: Create default singleton if absent
    return this.prisma.workSchedule.upsert({
      where: { id: DEFAULT_WORK_SCHEDULE_ID },
      update: {},
      create: DEFAULT_WORK_SCHEDULE,
    });
  }

  async update(dto: UpdateWorkScheduleDto): Promise<WorkSchedule> {
    return this.prisma.workSchedule.upsert({
      where: { id: DEFAULT_WORK_SCHEDULE_ID },
      update: {
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.lateToleranceMinutes !== undefined && {
          lateToleranceMinutes: dto.lateToleranceMinutes,
        }),
        ...(dto.standardWorkMinutes !== undefined && {
          standardWorkMinutes: dto.standardWorkMinutes,
        }),
      },
      create: {
        ...DEFAULT_WORK_SCHEDULE,
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.lateToleranceMinutes !== undefined && {
          lateToleranceMinutes: dto.lateToleranceMinutes,
        }),
        ...(dto.standardWorkMinutes !== undefined && {
          standardWorkMinutes: dto.standardWorkMinutes,
        }),
      },
    });
  }
}
