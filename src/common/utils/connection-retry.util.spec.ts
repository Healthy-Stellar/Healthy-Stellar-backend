import {
  createTypeOrmRetryCallback,
  createRedisRetryStrategy,
  MAX_RETRIES,
  RETRY_DELAY_MS,
} from './connection-retry.util';

describe('connection-retry.util', () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createTypeOrmRetryCallback', () => {
    it('should return true and log attempt number on each retry before max', () => {
      const toRetry = createTypeOrmRetryCallback();

      for (let i = 1; i < MAX_RETRIES; i++) {
        const result = toRetry(new Error('conn refused'));
        expect(result).toBe(true);
        expect(errorSpy).toHaveBeenCalledWith(
          `[TypeORM] Database connection attempt ${i} failed. Error: conn refused`,
        );
        expect(exitSpy).not.toHaveBeenCalled();
      }
    });

    it('should call process.exit(1) after max retries exhausted', () => {
      const toRetry = createTypeOrmRetryCallback();

      for (let i = 1; i <= MAX_RETRIES; i++) {
        toRetry(new Error('conn refused'));
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        `[TypeORM] Max connection retries (${MAX_RETRIES}) exhausted. Exiting...`,
      );
    });

    it('should respect custom maxRetries', () => {
      const toRetry = createTypeOrmRetryCallback(3);

      toRetry(new Error('e'));
      toRetry(new Error('e'));
      expect(exitSpy).not.toHaveBeenCalled();

      toRetry(new Error('e'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should log the error message from the thrown error', () => {
      const toRetry = createTypeOrmRetryCallback();
      toRetry(new Error('ECONNREFUSED 127.0.0.1:5432'));

      expect(errorSpy).toHaveBeenCalledWith(
        '[TypeORM] Database connection attempt 1 failed. Error: ECONNREFUSED 127.0.0.1:5432',
      );
    });

    it('each callback instance maintains its own attempt counter', () => {
      const toRetry1 = createTypeOrmRetryCallback();
      const toRetry2 = createTypeOrmRetryCallback();

      toRetry1(new Error('e'));
      toRetry1(new Error('e'));
      toRetry2(new Error('e'));

      expect(errorSpy).toHaveBeenCalledWith(
        '[TypeORM] Database connection attempt 2 failed. Error: e',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        '[TypeORM] Database connection attempt 1 failed. Error: e',
      );
    });
  });

  describe('createRedisRetryStrategy', () => {
    it('should return delay ms and log attempt number before max retries', () => {
      const retryStrategy = createRedisRetryStrategy();

      for (let i = 1; i < MAX_RETRIES; i++) {
        const result = retryStrategy(i);
        expect(result).toBe(RETRY_DELAY_MS);
        expect(errorSpy).toHaveBeenCalledWith(
          `[Redis] Connection attempt ${i} failed.`,
        );
        expect(exitSpy).not.toHaveBeenCalled();
      }
    });

    it('should call process.exit(1) when times reaches max retries', () => {
      const retryStrategy = createRedisRetryStrategy();

      retryStrategy(MAX_RETRIES);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        `[Redis] Max connection retries (${MAX_RETRIES}) exhausted. Exiting...`,
      );
    });

    it('should respect custom maxRetries and delayMs', () => {
      const retryStrategy = createRedisRetryStrategy(3, 1000);

      expect(retryStrategy(1)).toBe(1000);
      expect(retryStrategy(2)).toBe(1000);
      expect(exitSpy).not.toHaveBeenCalled();

      retryStrategy(3);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should use default delay of 3000ms', () => {
      const retryStrategy = createRedisRetryStrategy();
      expect(retryStrategy(1)).toBe(3000);
    });
  });
});
