import { Test, TestingModule } from '@nestjs/testing';
import { WorkScheduleService } from './work-schedule.service';
import { WorkScheduleRepository } from './work-schedule.repository';
import {
  DEFAULT_WORK_SCHEDULE,
  DEFAULT_WORK_SCHEDULE_ID,
} from './work-schedule.constants';

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;
  let repository: jest.Mocked<Partial<WorkScheduleRepository>>;

  const mockSchedule = {
    ...DEFAULT_WORK_SCHEDULE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findActive: jest.fn().mockResolvedValue(mockSchedule),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkScheduleService,
        {
          provide: WorkScheduleRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<WorkScheduleService>(WorkScheduleService);
  });

  describe('getActiveSchedule()', () => {
    it('1. Sukses mengambil jadwal kerja aktif singleton', async () => {
      const result = await service.getActiveSchedule();

      expect(result).toEqual(mockSchedule);
      expect(repository.findActive).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSchedule()', () => {
    it('2. Sukses memperbarui konfigurasi jadwal kerja', async () => {
      const updateDto = {
        startTime: '08:30',
        lateToleranceMinutes: 10,
        standardWorkMinutes: 450,
      };

      const updatedSchedule = {
        ...mockSchedule,
        ...updateDto,
      };

      repository.update = jest.fn().mockResolvedValue(updatedSchedule);

      const result = await service.updateSchedule(updateDto);

      expect(result.startTime).toBe('08:30');
      expect(result.lateToleranceMinutes).toBe(10);
      expect(result.standardWorkMinutes).toBe(450);
      expect(repository.update).toHaveBeenCalledWith(updateDto);
    });
  });
});
