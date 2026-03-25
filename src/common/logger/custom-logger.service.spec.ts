import { Test, TestingModule } from '@nestjs/testing';
import { CustomLoggerService } from './custom-logger.service';
import { PinoLogger } from 'nestjs-pino';

describe('CustomLoggerService', () => {
  let service: CustomLoggerService;
  let pinoLogger: PinoLogger;

  beforeEach(async () => {
    const mockPinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      setContext: jest.fn(),
      context: 'TestContext',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomLoggerService,
        {
          provide: PinoLogger,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<CustomLoggerService>(CustomLoggerService);
    pinoLogger = module.get<PinoLogger>(PinoLogger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set context', () => {
    service.setContext('NewContext');
    expect(pinoLogger.setContext).toHaveBeenCalledWith('NewContext');
  });

  it('should log info message', () => {
    service.log('Test message');
    expect(pinoLogger.info).toHaveBeenCalled();
  });

  it('should log error message', () => {
    service.error('Error message', 'stack trace');
    expect(pinoLogger.error).toHaveBeenCalled();
  });

  it('should log warning message', () => {
    service.warn('Warning message');
    expect(pinoLogger.warn).toHaveBeenCalled();
  });

  it('should log debug message', () => {
    service.debug('Debug message');
    expect(pinoLogger.debug).toHaveBeenCalled();
  });

  it('should log audit event', () => {
    service.audit('USER_LOGIN', { userId: '123' });
    expect(pinoLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        auditEvent: 'USER_LOGIN',
        logType: 'audit',
      }),
      'AUDIT: USER_LOGIN',
    );
  });

  it('should log security event', () => {
    service.security('FAILED_LOGIN', { attempts: 3 });
    expect(pinoLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        securityEvent: 'FAILED_LOGIN',
        logType: 'security',
      }),
      'SECURITY: FAILED_LOGIN',
    );
  });

  it('should log performance metric', () => {
    service.performance('DATABASE_QUERY', 250);
    expect(pinoLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'DATABASE_QUERY',
        duration: 250,
        logType: 'performance',
      }),
      'PERFORMANCE: DATABASE_QUERY took 250ms',
    );
  });
});
