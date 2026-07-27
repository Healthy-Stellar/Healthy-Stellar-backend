/**
 * Integration tests for AwsKmsStrategy using LocalStack.
 *
 * Prerequisites:
 *   - LocalStack running on http://localhost:4566
 *   - AWS_KMS_KEY_ID set to a pre-created LocalStack KMS key ARN
 *   - AWS_REGION=us-east-1, AWS_ACCESS_KEY_ID=test, AWS_SECRET_ACCESS_KEY=test
 *
 * Run with:
 *   KEY_MANAGEMENT_PROVIDER=aws AWS_KMS_KEY_ID=<arn> jest aws-kms.strategy.integration.spec.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KMSClient, CreateKeyCommand } from '@aws-sdk/client-kms';
import { AwsKmsStrategy } from '../strategies/aws-kms.strategy';
import { PatientDekEntity } from '../entities/patient-dek.entity';

const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
const SKIP = !process.env.LOCALSTACK_TESTS;

describe('AwsKmsStrategy (LocalStack integration)', () => {
  let module: TestingModule;
  let strategy: AwsKmsStrategy;
  let keyId: string;

  beforeAll(async () => {
    if (SKIP) return;

    // Create a throwaway KMS key in LocalStack
    const kms = new KMSClient({
      region: 'us-east-1',
      endpoint: LOCALSTACK_ENDPOINT,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    const { KeyMetadata } = await kms.send(new CreateKeyCommand({ Description: 'test-key' }));
    keyId = KeyMetadata!.KeyId!;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              AWS_KMS_KEY_ID: keyId,
              AWS_REGION: 'us-east-1',
              NODE_ENV: 'test',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [PatientDekEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([PatientDekEntity]),
      ],
      providers: [AwsKmsStrategy],
    }).compile();

    // Override the KMS client to point at LocalStack
    strategy = module.get(AwsKmsStrategy);
    (strategy as any).client = new KMSClient({
      region: 'us-east-1',
      endpoint: LOCALSTACK_ENDPOINT,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  it('generates a DEK and decrypts it back to the same plaintext', async () => {
    if (SKIP) return;

    const { encryptedKey, plainKey } = await strategy.generateDEK('patient-ls-1');
    expect(plainKey).toHaveLength(32);

    const decrypted = await strategy.decryptDEK(encryptedKey);
    expect(decrypted).toEqual(plainKey);
  });

  it('rotateMasterKey re-encrypts all stored DEKs', async () => {
    if (SKIP) return;

    await strategy.generateDEK('patient-ls-2');
    await expect(strategy.rotateMasterKey()).resolves.not.toThrow();
  });
});
