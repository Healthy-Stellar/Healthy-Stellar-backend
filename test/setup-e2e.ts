/**
 * E2E Test Setup
 * 
 * This file is executed before each E2E test suite.
 * It configures the test environment for integration testing with real services.
 */

import { customMatchers } from './utils/custom-matchers';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load test environment variables
dotenv.config({ path: join(__dirname, '.env.test') });

// Register custom matchers
expect.extend(customMatchers);

// Set longer timeout for E2E tests
jest.setTimeout(60000);

// Mock external services that should not be called in E2E tests
// Stellar and IPFS are mocked even in E2E to avoid external dependencies
jest.mock('@stellar/stellar-sdk', () => ({
  Server: jest.fn().mockImplementation(() => ({
    loadAccount: jest.fn().mockResolvedValue({
      accountId: () => 'MOCK_ACCOUNT_ID',
      sequenceNumber: () => '1',
      incrementSequenceNumber: jest.fn(),
    }),
    submitTransaction: jest.fn().mockResolvedValue({
      hash: 'mock_transaction_hash_' + Date.now(),
      successful: true,
    }),
  })),
  Keypair: {
    random: jest.fn(() => ({
      publicKey: () => 'MOCK_PUBLIC_KEY_' + Date.now(),
      secret: () => 'MOCK_SECRET_KEY',
    })),
    fromSecret: jest.fn((secret) => ({
      publicKey: () => 'MOCK_PUBLIC_KEY_FROM_SECRET',
      secret: () => secret,
    })),
  },
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({
      sign: jest.fn(),
      toXDR: jest.fn(() => 'mock_xdr'),
    }),
  })),
  Operation: {
    payment: jest.fn(),
    manageData: jest.fn(),
  },
  Asset: {
    native: jest.fn(() => ({ code: 'XLM' })),
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
}));

// Mock IPFS client for E2E tests
jest.mock('ipfs-http-client', () => ({
  create: jest.fn(() => ({
    add: jest.fn(async (content) => {
      const hash = 'Qm' + Buffer.from(content).toString('base64').substring(0, 44);
      return {
        path: hash,
        cid: {
          toString: () => hash,
        },
      };
    }),
    cat: jest.fn(async function* (cid) {
      yield Buffer.from('mock file content for ' + cid);
    }),
    pin: {
      add: jest.fn().mockResolvedValue({}),
    },
  })),
}));

// Keep console output for E2E tests to help with debugging
// But can be suppressed with DEBUG=false
if (process.env.DEBUG === 'false') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}

// Global E2E test utilities
global.waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

global.retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await global.waitFor(delay);
    }
  }
  throw new Error('Max retries exceeded');
};
