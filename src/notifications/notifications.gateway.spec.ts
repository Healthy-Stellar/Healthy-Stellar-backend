import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationEventType } from './interfaces/notification-event.interface';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let queueService: jest.Mocked<NotificationQueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: NotificationQueueService,
          useValue: {
            getQueuedEvents: jest.fn(),
            queueEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    queueService = module.get(NotificationQueueService);
  });

  describe('handleConnection', () => {
    it('should join user room and deliver queued events', async () => {
      const mockClient = {
        data: { user: { userId: 'user-123' } },
        join: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      const queuedEvents = [
        {
          eventType: NotificationEventType.RECORD_ACCESSED,
          actorId: 'actor-1',
          resourceId: 'resource-1',
          timestamp: new Date(),
        },
      ];

      queueService.getQueuedEvents.mockResolvedValue(queuedEvents);

      await gateway.handleConnection(mockClient as any);

      expect(mockClient.join).toHaveBeenCalledWith('user-123');
      expect(queueService.getQueuedEvents).toHaveBeenCalledWith('user-123');
      expect(mockClient.emit).toHaveBeenCalledWith('queued.events', queuedEvents);
    });

    it('should disconnect if no userId', async () => {
      const mockClient = {
        data: {},
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(mockClient as any);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should leave user room', () => {
      const mockClient = {
        data: { user: { userId: 'user-123' } },
        leave: jest.fn(),
      };

      gateway.handleDisconnect(mockClient as any);

      expect(mockClient.leave).toHaveBeenCalledWith('user-123');
    });
  });

  describe('emitNotification', () => {
    it('should emit to connected user', () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        sockets: {
          adapter: {
            rooms: new Map([['user-123', new Set(['socket-1'])]]),
          },
        },
      };

      gateway.server = mockServer as any;

      const event = {
        eventType: NotificationEventType.RECORD_ACCESSED,
        actorId: 'actor-1',
        resourceId: 'user-123',
        timestamp: new Date(),
      };

      gateway.emitNotification(event);

      expect(mockServer.to).toHaveBeenCalledWith('user-123');
      expect(mockServer.emit).toHaveBeenCalledWith(event.eventType, event);
    });

    it('should queue event for offline user', () => {
      const mockServer = {
        sockets: {
          adapter: {
            rooms: new Map(),
          },
        },
      };

      gateway.server = mockServer as any;

      const event = {
        eventType: NotificationEventType.RECORD_ACCESSED,
        actorId: 'actor-1',
        resourceId: 'user-123',
        timestamp: new Date(),
      };

      gateway.emitNotification(event);

      expect(queueService.queueEvent).toHaveBeenCalledWith('user-123', event);
    });
  });
});
