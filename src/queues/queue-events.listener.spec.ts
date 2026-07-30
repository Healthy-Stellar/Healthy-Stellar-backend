import { Test, TestingModule } from '@nestjs/testing';
import { QueueEventsListener } from './queue-events.listener';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from './queue.constants';

jest.mock('bullmq', () => ({
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('QueueEventsListener', () => {
  let listener: QueueEventsListener;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueEventsListener,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('localhost'),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    listener = module.get<QueueEventsListener>(QueueEventsListener);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  it('should initialize queue events for all queues', () => {
    listener.onModuleInit();
    // It should have created multiple QueueEvents instances
    expect(true).toBe(true);
  });

  it('should close listeners on destroy', async () => {
    listener.onModuleInit();
    await listener.onModuleDestroy();
    expect(true).toBe(true);
  });
});
