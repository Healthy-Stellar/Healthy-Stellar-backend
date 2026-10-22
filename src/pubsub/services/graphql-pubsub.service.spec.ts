import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GraphqlPubSubService } from './graphql-pubsub.service';

/** Minimal async iterator that records whether return() was called. */
function buildMockIterator(events: any[] = []) {
  let index = 0;
  let returnCalled = false;

  const iterator: AsyncIterator<any> = {
    next: jest.fn().mockImplementation(() => {
      if (index < events.length) {
        return Promise.resolve({ value: events[index++], done: false });
      }
      // Hang indefinitely to simulate a live subscription
      return new Promise(() => {});
    }),
    return: jest.fn().mockImplementation(() => {
      returnCalled = true;
      return Promise.resolve({ value: undefined, done: true });
    }),
  };

  return { iterator, isReturnCalled: () => returnCalled };
}

describe('GraphqlPubSubService — subscription cleanup', () => {
  let service: GraphqlPubSubService;

  const mockPubSub = {
    asyncIterator: jest.fn(),
    publish: jest.fn(),
  };

  const mockStreamRedis = {
    xadd: jest.fn().mockResolvedValue('1234-0'),
    expire: jest.fn().mockResolvedValue(1),
    xrange: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    scard: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    psubscribe: jest.fn(),
    on: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphqlPubSubService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(GraphqlPubSubService);

    // Bypass Redis initialization — inject mocks directly
    (service as any).pubSub = mockPubSub;
    (service as any).streamRedis = mockStreamRedis;
    (service as any).publisherRedis = { quit: jest.fn() };
    (service as any).subscriberRedis = { quit: jest.fn() };
    (service as any).revocationRedis = { psubscribe: jest.fn(), on: jest.fn(), quit: jest.fn() };
  });

  afterEach(() => jest.clearAllMocks());

  it('calls liveIterator.return() in finally when outer generator is cancelled', async () => {
    const { iterator, isReturnCalled } = buildMockIterator([]);
    mockPubSub.asyncIterator.mockReturnValue(iterator);

    const iterable = await service.recordAccessedIterator(
      'patient-1',
      undefined,
      'session-1',
      'user-1',
    );

    // Start consuming but immediately cancel via return()
    const gen = iterable[Symbol.asyncIterator]();
    await gen.return!(undefined);

    // Allow microtask queue to flush
    await Promise.resolve();
    await Promise.resolve();

    expect(isReturnCalled()).toBe(true);
  });

  it('removes iterator from trackedIterators after cleanup', async () => {
    const { iterator } = buildMockIterator([]);
    mockPubSub.asyncIterator.mockReturnValue(iterator);

    const iterable = await service.recordAccessedIterator(
      'patient-1',
      undefined,
      'session-1',
      'user-1',
    );

    expect((service as any).trackedIterators.size).toBe(1);

    const gen = iterable[Symbol.asyncIterator]();
    await gen.return!(undefined);
    await Promise.resolve();
    await Promise.resolve();

    expect((service as any).trackedIterators.size).toBe(0);
  });

  it('terminateIteratorsForSession calls liveIterator.return() and removes entry', async () => {
    const { iterator, isReturnCalled } = buildMockIterator([]);
    mockPubSub.asyncIterator.mockReturnValue(iterator);

    await service.recordAccessedIterator('patient-1', undefined, 'session-99', 'user-1');

    (service as any).terminateIteratorsForSession('session-99');
    // Termination resolves the terminationPromise; the generator will call return() next tick
    await Promise.resolve();
    await Promise.resolve();

    expect((service as any).trackedIterators.size).toBe(0);
  });
});
