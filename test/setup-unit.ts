/**
 * Unit Test Setup
 * 
 * This file is executed before each unit test suite.
 * It configures mocks for external services and sets up test utilities.
 */

import { customMatchers } from './utils/custom-matchers';

// Register custom matchers
expect.extend(customMatchers);

// Mock uuid for deterministic tests
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234-5678-9012-3456'),
  validate: jest.fn(() => true),
}));

// Set test timeout
jest.setTimeout(10000);

// Mock external services - these should NEVER make real calls in unit tests
jest.mock('@stellar/stellar-sdk', () => ({
  Server: jest.fn().mockImplementation(() => ({
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  })),
  Keypair: {
    random: jest.fn(() => ({
      publicKey: jest.fn(() => 'MOCK_PUBLIC_KEY'),
      secret: jest.fn(() => 'MOCK_SECRET_KEY'),
    })),
    fromSecret: jest.fn(() => ({
      publicKey: jest.fn(() => 'MOCK_PUBLIC_KEY'),
    })),
  },
  TransactionBuilder: jest.fn(),
  Operation: {
    payment: jest.fn(),
  },
  Asset: {
    native: jest.fn(),
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
}));

// Mock IPFS client
jest.mock('ipfs-http-client', () => ({
  create: jest.fn(() => ({
    add: jest.fn(async () => ({
      path: 'QmMockIPFSHash123456789',
      cid: {
        toString: () => 'QmMockIPFSHash123456789',
      },
    })),
    cat: jest.fn(async function* () {
      yield Buffer.from('mock file content');
    }),
    pin: {
      add: jest.fn(),
    },
  })),
}));

// Mock Redis for unit tests — shared in-memory store supports incr/decr/flushdb
jest.mock('ioredis', () => {
  const store: Record<string, string> = {};

  const RedisMock = jest.fn().mockImplementation(() => ({
    get:  jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    set:  jest.fn((key: string, value: string) => { store[key] = String(value); return Promise.resolve('OK'); }),
    del:  jest.fn((key: string) => { delete store[key]; return Promise.resolve(1); }),
    incr: jest.fn((key: string) => {
      store[key] = String((parseInt(store[key] ?? '0', 10) + 1));
      return Promise.resolve(parseInt(store[key], 10));
    }),
    decr: jest.fn((key: string) => {
      store[key] = String(Math.max(0, parseInt(store[key] ?? '0', 10) - 1));
      return Promise.resolve(parseInt(store[key], 10));
    }),
    expire:  jest.fn(() => Promise.resolve(1)),
    ttl:     jest.fn(() => Promise.resolve(-1)),
    keys:    jest.fn(() => Promise.resolve([])),
    flushdb: jest.fn(() => { Object.keys(store).forEach((k) => delete store[k]); return Promise.resolve('OK'); }),
    quit:    jest.fn(() => Promise.resolve('OK')),
    on:      jest.fn(),
    disconnect: jest.fn(),
  }));

  // Expose default and Cluster so nestjs-throttler-storage-redis instanceof checks pass
  RedisMock.default = RedisMock;
  RedisMock.Cluster = class ClusterMock {};
  return RedisMock;
});

// Mock Bull queues
jest.mock('bull', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

// Suppress console logs in tests unless debugging
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging test failures
    error: console.error,
  };
}

// Global test utilities
global.mockDate = (date: Date | string) => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(date));
};

global.restoreDate = () => {
  jest.useRealTimers();
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
