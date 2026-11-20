/**
 * #1326 — EncryptionService must wrap/unwrap DEKs through the persistent
 * KeyStore, so data encrypted before a restart is decryptable afterwards.
 *
 * Uses the real DbKeyStore (encrypted at rest with KEY_STORE_MASTER_KEY) over
 * an in-memory table that outlives each Nest module instance, standing in for
 * the database across a process restart.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { register } from 'prom-client';
import { EncryptionService } from './encryption.service';
import { KeyManagementService } from './key-management.service';
import { PersistentKeyManagementService } from './persistent-key-management.service';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { DbKeyStore } from '../../key-management/services/db-key-store.service';
import { KEY_STORE } from '../../key-management/interfaces/key-store.interface';

/** Minimal persistent "table" keyed by primary key patientAddress. */
class FakeDekTable {
  readonly rows = new Map<string, any>();
  async save(entity: any) {
    this.rows.set(entity.patientAddress, { ...entity });
    return entity;
  }
  async findOne({ where }: any) {
    return this.rows.get(where.patientAddress) ?? null;
  }
  async remove(entity: any) {
    this.rows.delete(entity.patientAddress);
  }
  async find() {
    return [...this.rows.values()];
  }
}

const MASTER_KEY = randomBytes(32).toString('hex');

async function bootEncryption(table: FakeDekTable): Promise<TestingModule> {
  // A real restart starts with an empty Prometheus registry.
  register.clear();
  const config = new ConfigService({ KEY_STORE_MASTER_KEY: MASTER_KEY });
  const mod = await Test.createTestingModule({
    providers: [
      EncryptionService,
      CircuitBreakerService,
      { provide: KeyManagementService, useClass: PersistentKeyManagementService },
      { provide: KEY_STORE, useFactory: () => new DbKeyStore(config, table as any) },
    ],
  }).compile();
  await mod.init(); // registers circuit breakers (CircuitBreakerService.onModuleInit)
  return mod;
}

describe('EncryptionService with persistent KEKs (#1326)', () => {
  it('encrypt → restart (new module instance) → decrypt succeeds', async () => {
    const table = new FakeDekTable();
    const payload = Buffer.from(JSON.stringify({ diagnosis: 'confidential' }));

    const first = await bootEncryption(table);
    const encrypted = await first.get(EncryptionService).encryptRecord(payload, 'patient-1');
    await first.close();

    // KEK was persisted (encrypted at rest), not held only in memory.
    expect(table.rows.size).toBe(1);
    const [stored] = [...table.rows.values()];
    expect(stored.ciphertext).not.toContain(MASTER_KEY);

    const second = await bootEncryption(table);
    const decrypted = await second.get(EncryptionService).decryptRecord(encrypted, 'patient-1');
    await second.close();

    expect(decrypted.equals(payload)).toBe(true);
  });

  it('creates a KEK on first use and reuses it for later records', async () => {
    const table = new FakeDekTable();
    const mod = await bootEncryption(table);
    const enc = mod.get(EncryptionService);

    await Promise.all([
      enc.encryptRecord(Buffer.from('a'), 'patient-2'),
      enc.encryptRecord(Buffer.from('b'), 'patient-2'),
      enc.encryptRecord(Buffer.from('c'), 'patient-2'),
    ]);
    expect(table.rows.size).toBe(1);
    await mod.close();
  });

  it('uses a distinct KEK per patient (cannot decrypt with another patient id)', async () => {
    const table = new FakeDekTable();
    const mod = await bootEncryption(table);
    const enc = mod.get(EncryptionService);

    const record = await enc.encryptRecord(Buffer.from('secret'), 'patient-a');
    await enc.encryptRecord(Buffer.from('x'), 'patient-b');
    await expect(enc.decryptRecord(record, 'patient-b')).rejects.toThrow();
    await mod.close();
  });

  it('decrypt for a patient without a KEK fails and does not create one', async () => {
    const table = new FakeDekTable();
    const mod = await bootEncryption(table);
    const enc = mod.get(EncryptionService);

    const record = await enc.encryptRecord(Buffer.from('secret'), 'patient-a');
    await expect(enc.decryptRecord(record, 'unknown-patient')).rejects.toThrow(/KEK not found/);
    expect(table.rows.size).toBe(1);
    await mod.close();
  });

  describe('GCM auth tag length is enforced (no truncated-tag forgeries)', () => {
    it('decryptRecord rejects a record whose auth tag was truncated', async () => {
      const mod = await bootEncryption(new FakeDekTable());
      const enc = mod.get(EncryptionService);
      const record = await enc.encryptRecord(Buffer.from('secret'), 'patient-t');

      for (const len of [4, 8, 12, 15]) {
        await expect(
          enc.decryptRecord({ ...record, authTag: record.authTag.subarray(0, len) }, 'patient-t'),
        ).rejects.toThrow(/authTag must be 16 bytes/);
      }
      await mod.close();
    });

    it('unwrapDek rejects a wrapped DEK with a truncated auth tag', async () => {
      const mod = await bootEncryption(new FakeDekTable());
      const enc = mod.get(EncryptionService);
      const kms = mod.get(KeyManagementService) as unknown as PersistentKeyManagementService;
      const record = await enc.encryptRecord(Buffer.from('secret'), 'patient-t');

      // Drop the last 12 bytes of the 16-byte tag: a 4-byte "tag" would be
      // accepted by GCM if the expected length were not pinned.
      const truncated = record.encryptedDek.subarray(0, record.encryptedDek.length - 12);
      await expect(kms.unwrapDek(truncated, 'patient-t')).rejects.toThrow(/Failed to unwrap DEK/);
      await expect(kms.unwrapDek(Buffer.alloc(10), 'patient-t')).rejects.toThrow(/malformed/);
      await mod.close();
    });

    it('round-trips normally with full-length tags', async () => {
      const mod = await bootEncryption(new FakeDekTable());
      const enc = mod.get(EncryptionService);
      const record = await enc.encryptRecord(Buffer.from('secret'), 'patient-t');
      expect(record.authTag.length).toBe(16);
      expect((await enc.decryptRecord(record, 'patient-t')).toString()).toBe('secret');
      await mod.close();
    });
  });
});
