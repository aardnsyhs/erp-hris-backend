import { Logger } from '@nestjs/common';
import { ScheduledJob } from '../job.interface';

const logger = new Logger('SamplePlaceholderJob');

/**
 * Sample placeholder scheduled job demonstrating the ScheduledJob pattern.
 * Runs on a daily schedule (02:00 AM) and performs a safe heartbeat check with no side effects.
 */
export const SamplePlaceholderJob: ScheduledJob = {
  name: 'sample-placeholder-cleanup',
  description: 'Placeholder sample job to verify cron scheduling pipeline',
  cronExpression: '0 2 * * *', // Daily at 02:00
  isEnabled: false, // Disabled by default in production to prevent noise
  runOnInit: false,
  handler: async () => {
    logger.log(
      'Sample placeholder job executed. Pipeline is healthy and functional.',
    );
  },
};
