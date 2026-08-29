import { Test, TestingModule } from '@nestjs/testing';
import { JobSchedulerService } from './job-scheduler.service';
import { ScheduledJob } from './job.interface';

describe('JobSchedulerService', () => {
  let service: JobSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobSchedulerService],
    }).compile();

    service = module.get<JobSchedulerService>(JobSchedulerService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerJob()', () => {
    it('should register a valid scheduled job', () => {
      const handler = jest.fn();
      const job: ScheduledJob = {
        name: 'test-job',
        cronExpression: '*/5 * * * *',
        handler,
      };

      service.registerJob(job);
      const jobs = service.getJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].name).toBe('test-job');
      expect(jobs[0].cronExpression).toBe('*/5 * * * *');
      expect(jobs[0].isRunning).toBe(true);
    });

    it('should throw an error for invalid cron expressions', () => {
      const job: ScheduledJob = {
        name: 'invalid-job',
        cronExpression: 'invalid-cron-string',
        handler: jest.fn(),
      };

      expect(() => service.registerJob(job)).toThrow(
        'Invalid cron expression',
      );
    });
  });

  describe('triggerJob()', () => {
    it('should execute the job handler manually and mark SUCCESS', async () => {
      let executed = false;
      const job: ScheduledJob = {
        name: 'manual-trigger-job',
        cronExpression: '0 0 * * *',
        isEnabled: false,
        handler: async () => {
          executed = true;
        },
      };

      service.registerJob(job);
      await service.triggerJob('manual-trigger-job');

      expect(executed).toBe(true);
      const [status] = service.getJobs();
      expect(status.lastStatus).toBe('SUCCESS');
      expect(status.lastRunAt).toBeInstanceOf(Date);
    });

    it('should catch errors in handler and mark status as FAILED', async () => {
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      const job: ScheduledJob = {
        name: 'failing-job',
        cronExpression: '0 0 * * *',
        isEnabled: false,
        handler: async () => {
          throw new Error('Database connection failed');
        },
      };

      service.registerJob(job);
      await service.triggerJob('failing-job');

      const [status] = service.getJobs();
      expect(status.lastStatus).toBe('FAILED');
      expect(status.lastError).toBe('Database connection failed');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Job failed: "failing-job":',
        expect.any(Error),
      );

      loggerSpy.mockRestore();
    });

    it('should throw error when triggering an unregistered job', async () => {
      await expect(service.triggerJob('unknown-job')).rejects.toThrow(
        'Job "unknown-job" is not registered',
      );
    });
  });

  describe('startJob() and stopJob()', () => {
    it('should toggle job running state', () => {
      const job: ScheduledJob = {
        name: 'toggle-job',
        cronExpression: '0 1 * * *',
        isEnabled: false,
        handler: jest.fn(),
      };

      service.registerJob(job);
      expect(service.getJobs()[0].isRunning).toBe(false);

      expect(service.startJob('toggle-job')).toBe(true);
      expect(service.getJobs()[0].isRunning).toBe(true);

      expect(service.stopJob('toggle-job')).toBe(true);
      expect(service.getJobs()[0].isRunning).toBe(false);
    });

    it('should return false when starting/stopping unknown job', () => {
      expect(service.startJob('unknown')).toBe(false);
      expect(service.stopJob('unknown')).toBe(false);
    });
  });
});
