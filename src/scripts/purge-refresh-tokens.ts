import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';

export interface PurgeResult {
  purgedCount: number;
  durationMs: number;
}

export interface RunnerLogger {
  log: (message: string) => void;
  error: (message: string, trace?: string) => void;
}

/**
 * Pure execution logic: calls authService.purgeStaleTokens(), measures duration,
 * and logs sanitized output without exposing credentials, tokens, or hashes.
 */
export async function executePurge(
  authService: Pick<AuthService, 'purgeStaleTokens'>,
  logger: RunnerLogger,
  retentionDays?: number,
): Promise<PurgeResult> {
  const startTime = Date.now();
  logger.log('[Maintenance:PurgeTokens] Starting refresh token cleanup...');

  const result = await authService.purgeStaleTokens(retentionDays);
  const durationMs = Date.now() - startTime;

  logger.log(
    `[Maintenance:PurgeTokens] Cleanup completed successfully. Summary: { purgedCount: ${result.count}, durationMs: ${durationMs} }`,
  );

  return {
    purgedCount: result.count,
    durationMs,
  };
}

/**
 * Headless Application Context bootstrap:
 * Creates headless application context (NO HTTP listener is started),
 * resolves AuthService via NestJS DI, runs purge, and ensures app.close() is called
 * in a finally block across all paths (success and failure) to cleanly close database pools.
 */
export async function runPurgeRunner(
  contextFactory: () => Promise<INestApplicationContext> = () =>
    NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    }),
  logger: RunnerLogger = new Logger('PurgeTokensRunner'),
  retentionDays?: number,
): Promise<PurgeResult> {
  let app: INestApplicationContext | null = null;
  try {
    app = await contextFactory();
    const authService = app.get(AuthService);
    return await executePurge(authService, logger, retentionDays);
  } catch (error: any) {
    logger.error(
      `[Maintenance:PurgeTokens] Cleanup failed: ${error?.message || error}`,
    );
    throw error;
  } finally {
    if (app) {
      await app.close();
    }
  }
}

/**
 * CLI execution entrypoint:
 * Sets exit code 0 on success, exit code 1 on unhandled exception.
 */
export async function main(): Promise<void> {
  try {
    await runPurgeRunner();
    process.exit(0);
  } catch (_error) {
    process.exit(1);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  void main();
}
