import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as cron from 'node-cron';
import { ScheduledJob, ScheduledJobStatus } from './job.interface';

interface RegisteredJobMeta {
  job: ScheduledJob;
  task?: cron.ScheduledTask;
  isRunning: boolean;
  lastRunAt?: Date;
  lastStatus?: 'SUCCESS' | 'FAILED';
  lastError?: string;
}

@Injectable()
export class JobSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly jobs = new Map<string, RegisteredJobMeta>();

  onModuleInit() {
    this.logger.log('Initializing JobSchedulerService...');
    // Start all jobs marked as enabled
    for (const [name, meta] of this.jobs.entries()) {
      if (meta.job.isEnabled !== false) {
        this.startJob(name);
      }
    }
  }

  onModuleDestroy() {
    this.logger.log('Shutting down JobSchedulerService and stopping all jobs...');
    for (const name of this.jobs.keys()) {
      this.stopJob(name);
    }
  }

  /**
   * Registers a scheduled job with the scheduler.
   */
  registerJob(job: ScheduledJob): void {
    if (!cron.validate(job.cronExpression)) {
      throw new Error(
        `Invalid cron expression "${job.cronExpression}" for job "${job.name}"`,
      );
    }

    if (this.jobs.has(job.name)) {
      this.logger.warn(`Job "${job.name}" is already registered. Overwriting.`);
      this.stopJob(job.name);
    }

    this.jobs.set(job.name, {
      job,
      isRunning: false,
    });

    this.logger.log(
      `Job registered: "${job.name}" with schedule "${job.cronExpression}"`,
    );

    // Auto-start if enabled (and if module is already initialized or by default)
    if (job.isEnabled !== false) {
      this.startJob(job.name);
    }

    // Execute once on init if requested
    if (job.runOnInit) {
      this.triggerJob(job.name).catch((err) => {
        this.logger.error(`Initial run failed for job "${job.name}":`, err);
      });
    }
  }

  /**
   * Starts a registered scheduled job.
   */
  startJob(name: string): boolean {
    const meta = this.jobs.get(name);
    if (!meta) {
      this.logger.warn(`Cannot start unregistered job "${name}"`);
      return false;
    }

    if (meta.task) {
      meta.task.stop();
    }

    const task = cron.schedule(
      meta.job.cronExpression,
      async () => {
        await this.executeJobHandler(name);
      },
    );

    meta.task = task;
    meta.isRunning = true;
    this.logger.log(`Job started: "${name}"`);
    return true;
  }

  /**
   * Stops a registered scheduled job.
   */
  stopJob(name: string): boolean {
    const meta = this.jobs.get(name);
    if (!meta || !meta.task) {
      return false;
    }

    meta.task.stop();
    meta.task = undefined;
    meta.isRunning = false;
    this.logger.log(`Job stopped: "${name}"`);
    return true;
  }

  /**
   * Manually triggers a job handler once (useful for testing and on-demand sync).
   */
  async triggerJob(name: string): Promise<void> {
    const meta = this.jobs.get(name);
    if (!meta) {
      throw new Error(`Job "${name}" is not registered`);
    }

    await this.executeJobHandler(name);
  }

  /**
   * Internal execution wrapper tracking status, timing, and errors.
   */
  private async executeJobHandler(name: string): Promise<void> {
    const meta = this.jobs.get(name);
    if (!meta) return;

    this.logger.log(`Executing scheduled job: "${name}"...`);
    meta.lastRunAt = new Date();

    try {
      await meta.job.handler();
      meta.lastStatus = 'SUCCESS';
      meta.lastError = undefined;
      this.logger.log(`Job completed successfully: "${name}"`);
    } catch (error: any) {
      meta.lastStatus = 'FAILED';
      meta.lastError = error?.message || String(error);
      this.logger.error(`Job failed: "${name}":`, error);
    }
  }

  /**
   * Returns list of all registered jobs and their status.
   */
  getJobs(): ScheduledJobStatus[] {
    return Array.from(this.jobs.values()).map((meta) => ({
      name: meta.job.name,
      cronExpression: meta.job.cronExpression,
      description: meta.job.description,
      isEnabled: meta.job.isEnabled !== false,
      isRunning: meta.isRunning,
      lastRunAt: meta.lastRunAt,
      lastStatus: meta.lastStatus,
      lastError: meta.lastError,
    }));
  }
}
