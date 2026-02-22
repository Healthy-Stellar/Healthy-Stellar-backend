import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationEventType } from '../interfaces/notification-event.interface';

const mockRedis = {
  multi: jest.fn().mockReturnThis(),
  lpush: jest.fn().mockReturnThis(),
  ltrim: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
  lrange: jest.fn().mockResolvedValue([]),
  del: jest.fn().mockResolvedValue(1),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedis));

describe('NotificationQueueService', () => {
  let service: NotificationQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationQueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationQueueService>(NotificationQueueService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should queue event with TTL and max limit', async () => {
    const event = {
      eventType: NotificationEventType.RECORD_ACCESSED,
      actorId: 'actor-1',
      resourceId: 'resource-1',
      timestamp: new Date(),
    };

    await service.queueEvent('user-123', event);

    expect(mockRedis.lpush).toHaveBeenCalledWith('notifications:user-123', JSON.stringify(event));
    expect(mockRedis.ltrim).toHaveBeenCalledWith('notifications:user-123', 0, 49);
    expect(mockRedis.expire).toHaveBeenCalledWith('notifications:user-123', 86400);
  });

  it('should retrieve and clear queued events', async () => {
    const events = [
      JSON.stringify({
        eventType: NotificationEventType.RECORD_ACCESSED,
        actorId: 'actor-1',
        resourceId: 'resource-1',
        timestamp: new Date(),
      }),
    ];

    mockRedis.lrange.mockResolvedValue(events);

    const result = await service.getQueuedEvents('user-123');

    expect(mockRedis.lrange).toHaveBeenCalledWith('notifications:user-123', 0, -1);
    expect(mockRedis.del).toHaveBeenCalledWith('notifications:user-123');
    expect(result).toHaveLength(1);
  });
});
