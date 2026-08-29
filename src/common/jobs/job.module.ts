import { Module, Global, OnModuleInit } from '@nestjs/common';
import { JobSchedulerService } from './job-scheduler.service';
import { SamplePlaceholderJob } from './jobs/sample-placeholder.job';

@Global()
@Module({
  providers: [JobSchedulerService],
  exports: [JobSchedulerService],
})
export class JobModule implements OnModuleInit {
  constructor(private readonly scheduler: JobSchedulerService) {}

  onModuleInit() {
    this.scheduler.registerJob(SamplePlaceholderJob);
  }
}
