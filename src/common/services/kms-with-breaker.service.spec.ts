import { ConfigService } from '@nestjs/config';
import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { KmsWithBreakerService } from './kms-with-breaker.service';

jest.mock('@aws-sdk/client-kms', () => ({
  KMSClient: jest.fn(),
  EncryptCommand: jest.fn(function EncryptCommand(input) {
    this.input = input;
  }),
  DecryptCommand: jest.fn(function DecryptCommand(input) {
    this.input = input;
  }),
  GenerateDataKeyCommand: jest.fn(function GenerateDataKeyCommand(input) {
    this.input = input;
  }),
}));

describe('KmsWithBreakerService', () => {
  const send = jest.fn();
  const circuitBreaker = {
    execute: jest.fn(async (_serviceName: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as jest.Mocked<CircuitBreakerService>;
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'KMS_PROVIDER') return 'aws';
      if (key === 'AWS_REGION') return 'us-east-1';
      return defaultValue;
    }),
  } as unknown as jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    (KMSClient as jest.Mock).mockImplementation(() => ({ send }));
  });

  it('fails fast when AWS KMS region is not configured', () => {
    const missingRegionConfig = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'KMS_PROVIDER') return 'aws';
        if (key === 'AWS_REGION') return undefined;
        return defaultValue;
      }),
    } as unknown as ConfigService;

    expect(() => new KmsWithBreakerService(circuitBreaker, missingRegionConfig)).toThrow(
      'AWS_REGION must be set for AWS KMS encryption',
    );
  });

  it('encrypts by returning AWS KMS ciphertext, not plaintext', async () => {
    const service = new KmsWithBreakerService(circuitBreaker, configService);
    send.mockResolvedValue({ CiphertextBlob: Uint8Array.from([9, 8, 7]) });

    const result = await service.encrypt(Buffer.from([1, 2, 3]), 'key-1');

    expect(EncryptCommand).toHaveBeenCalledWith({
      KeyId: 'key-1',
      Plaintext: Buffer.from([1, 2, 3]),
    });
    expect(result).toEqual(Buffer.from([9, 8, 7]));
  });

  it('decrypts by returning AWS KMS plaintext, not ciphertext', async () => {
    const service = new KmsWithBreakerService(circuitBreaker, configService);
    send.mockResolvedValue({ Plaintext: Uint8Array.from([4, 5, 6]) });

    const result = await service.decrypt(Buffer.from([9, 8, 7]), 'key-1');

    expect(DecryptCommand).toHaveBeenCalledWith({
      KeyId: 'key-1',
      CiphertextBlob: Buffer.from([9, 8, 7]),
    });
    expect(result).toEqual(Buffer.from([4, 5, 6]));
  });

  it('generates a data key using AWS KMS ciphertext and plaintext', async () => {
    const service = new KmsWithBreakerService(circuitBreaker, configService);
    send.mockResolvedValue({
      Plaintext: Uint8Array.from([1, 2, 3]),
      CiphertextBlob: Uint8Array.from([7, 8, 9]),
    });

    const result = await service.generateDataKey('key-1');

    expect(GenerateDataKeyCommand).toHaveBeenCalledWith({
      KeyId: 'key-1',
      KeySpec: 'AES_256',
    });
    expect(result).toEqual({
      plaintext: Buffer.from([1, 2, 3]),
      ciphertext: Buffer.from([7, 8, 9]),
    });
  });
});
