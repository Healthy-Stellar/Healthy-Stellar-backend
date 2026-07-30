import { Test } from '@nestjs/testing';
import { SubscriptionsResolver, PUB_SUB } from './subscriptions.resolver';
import { PubSub } from 'graphql-subscriptions';

describe('SubscriptionsResolver', () => {
  let resolver: SubscriptionsResolver;
  let pubSub: PubSub;

  beforeEach(async () => {
    pubSub = new PubSub();
    const module = await Test.createTestingModule({
      providers: [
        SubscriptionsResolver,
        { provide: PUB_SUB, useValue: pubSub },
      ],
    }).compile();
    resolver = module.get(SubscriptionsResolver);
  });

  it('onNewRecord returns an async iterable iterator', () => {
    const iter = resolver.onNewRecord('p-1');
    expect(typeof iter[Symbol.asyncIterator]).toBe('function');
  });

  it('onAccessChanged returns an async iterable iterator', () => {
    const iter = resolver.onAccessChanged('p-1');
    expect(typeof iter[Symbol.asyncIterator]).toBe('function');
  });
});
