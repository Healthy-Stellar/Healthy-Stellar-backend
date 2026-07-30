import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DbKeyStore } from '../services/db-key-store.service';
import { AwsKmsKeyStore } from '../services/aws-kms-key-store.service';
import { KeyStoreFactory } from '../services/key-store-factory.service';
import { PatientDekEntity } from '../entities/patient-dek.entity';
import { KeyNotFoundException } from '../exceptions/key-management.exceptions';
const mockConfig = (overrides) => ({
  get: jest.fn((key, defaultVal) => overrides[key] ?? defaultVal ?? null),
  getOrThrow: jest.fn((key) => {
    if (!overrides[key]) throw new Error('Missing config: ' + key);
    return overrides[key];
  }),
});

const mockRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('DbKeyStore', () => {
  let store;
  let repo;

  beforeEach(async () => {
    const config = mockConfig({ KEY_STORE_MASTER_KEY: 'a'.repeat(64) });
    repo = mockRepo();

    const module = await Test.createTestingModule({
      providers: [
        DbKeyStore,
        { provide: ConfigService, useValue: config },
        { provide: getRepositoryToken(PatientDekEntity), useValue: repo },
      ],
    }).compile();

    store = module.get(DbKeyStore);
  });

  it('should throw if KEY_STORE_MASTER_KEY is missing', () => {
    const config = mockConfig({});
    expect(() => new DbKeyStore(config, mockRepo())).toThrow();
  });

  it('should store and retrieve a key', async () => {
    let savedCiphertext = '';
    repo.save.mockImplementation(async (entity) => {
      savedCiphertext = entity.ciphertext;
      return entity;
    });
    repo.findOne.mockImplementation(async () => ({
      patientAddress: 'test-key',
      ciphertext: savedCiphertext,
      iv: '',
      authTag: '',
      masterKeyVersion: 'db-key-store-v1',
      createdAt: new Date(),
    }));

    await store.storeKey('test-key', 'my-secret-key-123');
    const retrieved = await store.retrieveKey('test-key');
    expect(retrieved).toBe('my-secret-key-123');
  });

  it('should throw KeyNotFoundException for missing key', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(store.retrieveKey('nonexistent')).rejects.toThrow(KeyNotFoundException);
  });

  it('should delete an existing key', async () => {
    const entity = { patientAddress: 'test-key' };
    repo.findOne.mockResolvedValue(entity);
    repo.remove.mockResolvedValue(undefined);

    await store.deleteKey('test-key');
    expect(repo.remove).toHaveBeenCalledWith(entity);
  });

  it('should list keys', async () => {
    repo.find.mockResolvedValue([
      { patientAddress: 'key-1', ciphertext: Buffer.from('data').toString('base64'), masterKeyVersion: 'v1', createdAt: new Date('2026-01-01') },
    ]);
    const keys = await store.listKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].keyId).toBe('key-1');
  });

  it('should rotate (re-wrap) all keys', async () => {
    repo.find.mockResolvedValue([]);
    const result = await store.rotateWrappingKey();
    expect(result.rewrappedCount).toBe(0);
  });
});

describe('KeyStoreFactory', () => {
  it('should select database backend by default', () => {
    const config = mockConfig({});
    const factory = new KeyStoreFactory(config, {} , {});
    factory.onModuleInit();
    expect(factory.getStore()).toBeDefined();
  });

  it('should select aws-kms backend', () => {
    const config = mockConfig({ KEY_STORAGE_BACKEND: 'aws-kms' });
    const awsStore = {};
    const factory = new KeyStoreFactory(config, {}, awsStore);
    factory.onModuleInit();
    expect(factory.getStore()).toBe(awsStore);
  });

  it('should throw for unknown backend', () => {
    const config = mockConfig({ KEY_STORAGE_BACKEND: 'gcp-cloud' });
    const factory = new KeyStoreFactory(config, {}, {});
    expect(() => factory.onModuleInit()).toThrow();
  });
});

describe('AwsKmsKeyStore (mock HSM)', () => {
  it('should be constructable with config', () => {
    const config = mockConfig({ AWS_KMS_KEY_ID: 'arn:aws:kms:us-east-1:key/mock', AWS_REGION: 'us-east-1' });
    const store = new AwsKmsKeyStore(config);
    expect(store).toBeDefined();
  });

  it('should throw on storeKey if KMS calls fail', async () => {
    const config = mockConfig({ AWS_KMS_KEY_ID: 'arn:aws:kms:us-east-1:key/mock', AWS_REGION: 'us-east-1' });
    const store = new AwsKmsKeyStore(config);
    await expect(store.storeKey('test', 'secret')).rejects.toThrow();
  });
});
