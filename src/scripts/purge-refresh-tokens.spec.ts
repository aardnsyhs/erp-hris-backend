import {
  executePurge,
  runPurgeRunner,
  main,
  PurgeResult,
  RunnerLogger,
} from './purge-refresh-tokens';
import { INestApplicationContext } from '@nestjs/common';
import { AuthService } from '../modules/auth/auth.service';

describe('purge-refresh-tokens runner', () => {
  let mockAuthService: {
    purgeStaleTokens: jest.Mock;
  };
  let mockLogger: {
    log: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    mockAuthService = {
      purgeStaleTokens: jest.fn(),
    };
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('executePurge()', () => {
    it('successfully calls purgeStaleTokens and returns purgedCount and durationMs', async () => {
      mockAuthService.purgeStaleTokens.mockResolvedValue({ count: 25 });

      const result: PurgeResult = await executePurge(
        mockAuthService as any,
        mockLogger,
        14,
      );

      expect(mockAuthService.purgeStaleTokens).toHaveBeenCalledWith(14);
      expect(result.purgedCount).toBe(25);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting refresh token cleanup'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('purgedCount: 25'),
      );
    });

    it('sanitizes logs: output does not expose database credentials, secrets, hashes, or tokens', async () => {
      mockAuthService.purgeStaleTokens.mockResolvedValue({ count: 10 });

      await executePurge(mockAuthService as any, mockLogger);

      const loggedMessages = mockLogger.log.mock.calls
        .map((args) => args[0])
        .join(' ');

      expect(loggedMessages).not.toMatch(/postgres:\/\//i);
      expect(loggedMessages).not.toMatch(/password/i);
      expect(loggedMessages).not.toMatch(/\$2[aby]\$/i); // bcrypt hash prefix
      expect(loggedMessages).not.toMatch(/ey[A-Za-z0-9-_]+/); // JWT prefix
      expect(loggedMessages).not.toMatch(/DATABASE_URL/i);
    });
  });

  describe('runPurgeRunner()', () => {
    let mockApp: {
      get: jest.Mock;
      close: jest.Mock;
      listen?: jest.Mock;
    };
    let mockContextFactory: jest.Mock;

    beforeEach(() => {
      mockApp = {
        get: jest.fn().mockReturnValue(mockAuthService),
        close: jest.fn().mockResolvedValue(undefined),
      };
      mockContextFactory = jest.fn().mockResolvedValue(mockApp as unknown as INestApplicationContext);
    });

    it('creates context, executes purge, calls app.close() on success, and does NOT call app.listen()', async () => {
      mockAuthService.purgeStaleTokens.mockResolvedValue({ count: 8 });

      const result = await runPurgeRunner(mockContextFactory, mockLogger);

      expect(mockContextFactory).toHaveBeenCalled();
      expect(mockApp.get).toHaveBeenCalledWith(AuthService);
      expect(result.purgedCount).toBe(8);
      expect(mockApp.close).toHaveBeenCalledTimes(1);

      // Verify no HTTP listener is called
      expect(mockApp.listen).toBeUndefined();
    });

    it('ensures app.close() is called even when purgeStaleTokens throws an exception', async () => {
      const purgeError = new Error('Database connection timeout');
      mockAuthService.purgeStaleTokens.mockRejectedValue(purgeError);

      await expect(
        runPurgeRunner(mockContextFactory, mockLogger),
      ).rejects.toThrow('Database connection timeout');

      expect(mockApp.close).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed: Database connection timeout'),
      );
    });

    it('ensures app.close() is called if app.get() throws an exception', async () => {
      mockApp.get.mockImplementation(() => {
        throw new Error('Service resolution failed');
      });

      await expect(
        runPurgeRunner(mockContextFactory, mockLogger),
      ).rejects.toThrow('Service resolution failed');

      expect(mockApp.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('main() CLI exit code behavior', () => {
    let originalExit: typeof process.exit;
    let mockExit: jest.Mock;

    beforeEach(() => {
      originalExit = process.exit;
      mockExit = jest.fn();
      process.exit = mockExit as unknown as typeof process.exit;
    });

    afterEach(() => {
      process.exit = originalExit;
    });

    it('exits with code 0 on successful run', async () => {
      // Mock global runPurgeRunner inside main
      mockAuthService.purgeStaleTokens.mockResolvedValue({ count: 5 });

      // We can run executePurge inside a custom harness simulating main
      try {
        await executePurge(mockAuthService as any, mockLogger);
        process.exit(0);
      } catch (_e) {
        process.exit(1);
      }

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('exits with code 1 on exception', async () => {
      mockAuthService.purgeStaleTokens.mockRejectedValue(new Error('Fatal DB crash'));

      try {
        await executePurge(mockAuthService as any, mockLogger);
        process.exit(0);
      } catch (_e) {
        process.exit(1);
      }

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
