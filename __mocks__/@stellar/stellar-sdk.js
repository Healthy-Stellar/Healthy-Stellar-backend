'use strict';

/**
 * Jest manual mock for @stellar/stellar-sdk.
 *
 * Provides the minimal surface used by SorobanQueueService so that
 * dispatchGrantOrRevoke() can submit a transaction and return a real
 * (mock) transaction hash instead of a fabricated deterministic string.
 */

class Keypair {
  constructor(publicKey, secretKey) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
  }

  static fromSecret(secret) {
    return new Keypair(`G${secret.slice(1)}`, secret);
  }

  static random() {
    const secret = `S${Math.random().toString(36).slice(2).padEnd(55, '0')}`;
    return new Keypair(`G${secret.slice(1)}`, secret);
  }

  publicKey() {
    return this.publicKey;
  }

  secret() {
    return this.secretKey;
  }

  sign() {
    return Buffer.from('mock-signature');
  }
}

class Account {
  constructor(accountId, sequence) {
    this.accountId = accountId;
    this.sequence = sequence;
  }

  sequenceNumber() {
    return this.sequence;
  }

  incrementSequenceNumber() {
    this.sequence = (BigInt(this.sequence) + 1n).toString();
  }
}

class Contract {
  constructor(contractId) {
    this.contractId = contractId;
  }

  call(method, ...params) {
    return { contractId: this.contractId, method, params };
  }
}

class TransactionBuilder {
  constructor(sourceAccount, options = {}) {
    this.sourceAccount = sourceAccount;
    this.options = options;
    this.operations = [];
  }

  addOperation(operation) {
    this.operations.push(operation);
    return this;
  }

  setTimeout(timeout) {
    this.options.timeout = timeout;
    return this;
  }

  build() {
    return {
      source: this.sourceAccount.accountId,
      fee: this.options.fee,
      networkPassphrase: this.options.networkPassphrase,
      operations: this.operations,
      sign: jest.fn(),
      toXDR: () => 'mock-xdr',
    };
  }
}

class SorobanRpc {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }

  async getAccount(accountId) {
    return new Account(accountId, '0');
  }

  async simulateTransaction() {
    return {
      results: [{ retval: { toXDR: () => 'mock-retval' } }],
      transactionData: 'mock-transaction-data',
      minResourceFee: '100',
    };
  }

  async sendTransaction(transaction) {
    return {
      status: 'PENDING',
      hash: `mock-tx-hash-${Buffer.from(JSON.stringify(transaction.operations)).toString('hex').slice(0, 32)}`,
    };
  }

  async getTransaction(hash) {
    return {
      status: 'SUCCESS',
      hash,
      ledger: 1,
    };
  }
}

const Networks = {
  PUBLIC: 'Public Global Stellar Network ; September 2015',
  TESTNET: 'Test SDF Network ; September 2015',
  FUTURENET: 'Test SDF Future Network ; October 2022',
};

const BASE_FEE = '100';

const nativeToScVal = (value) => ({ value, toXDR: () => 'mock-scval' });
const scValToNative = (scVal) => (scVal && scVal.value !== undefined ? scVal.value : scVal);

const StrKey = {
  encodeEd25519PublicKey: (buf) => `G${Buffer.from(buf).toString('hex').slice(0, 55)}`,
  decodeEd25519PublicKey: (str) => Buffer.from(str.slice(1), 'hex'),
};

module.exports = {
  Keypair,
  Account,
  Contract,
  TransactionBuilder,
  SorobanRpc,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  StrKey,
};
