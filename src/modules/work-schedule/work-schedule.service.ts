import { Injectable } from '@nestjs/common';
import { WorkScheduleRepository } from './work-schedule.repository';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';

@Injectable()
export class WorkScheduleService {
  constructor(
    private readonly workScheduleRepository: WorkScheduleRepository,
  ) {}

  async getActiveSchedule() {
    return this.workScheduleRepository.findActive();
  }

  async updateSchedule(dto: UpdateWorkScheduleDto) {
    return this.workScheduleRepository.update(dto);
  }
}
