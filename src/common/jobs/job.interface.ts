export interface ScheduledJob {
  name: string;
  cronExpression: string;
  description?: string;
  isEnabled?: boolean;
  runOnInit?: boolean;
  handler: () => Promise<void> | void;
}

export interface ScheduledJobStatus {
  name: string;
  cronExpression: string;
  description?: string;
  isEnabled: boolean;
  isRunning: boolean;
  lastRunAt?: Date;
  lastStatus?: 'SUCCESS' | 'FAILED';
  lastError?: string;
}
