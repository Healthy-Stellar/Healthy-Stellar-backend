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

// Mock Redis for unit tests
jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(() => []),
    flushdb: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  }));
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
