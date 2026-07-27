import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { MedicalRecord, MedicalRecordStatus } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { NotificationsService } from '../notifications/services/notifications.service';
import {
  ReconciliationReport,
  DiscrepancyType,
  ReconciliationStatus,
} from './entities/reconciliation-report.entity';

interface OnChainState {
  patientCount: number;
  providerList: string[];
  recordCountByPatient: Record<string, number>;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private readonly server: StellarSdk.SorobanRpc.Server;
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  private readonly sourceKeypair: StellarSdk.Keypair;

  constructor(
    @InjectRepository(ReconciliationReport)
    private readonly reportRepo: Repository<ReconciliationReport>,
    @InjectRepository(MedicalRecord)
    private readonly recordRepo: Repository<MedicalRecord>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    const isMainnet = this.config.get('STELLAR_NETWORK') === 'mainnet';
    this.networkPassphrase = isMainnet ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;
    this.server = new StellarSdk.SorobanRpc.Server(
      isMainnet
        ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
        : 'https://soroban-testnet.stellar.org',
      { allowHttp: false },
    );
    this.contractId = this.config.get<string>('STELLAR_CONTRACT_ID', '');
    const secret = this.config.get<string>('STELLAR_SECRET_KEY', '');
    this.sourceKeypair = secret
      ? StellarSdk.Keypair.fromSecret(secret)
      : StellarSdk.Keypair.random();
  }

  // ─── Scheduled Entry Point ─────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runNightlyReconciliation(): Promise<void> {
    this.logger.log('Nightly reconciliation started');
    try {
      await this.reconcile();
    } catch (err: any) {
      this.logger.error('Reconciliation run failed', err?.stack);
    }
  }

  // ─── Public (also callable on-demand / in tests) ───────────────────────────

  async reconcile(): Promise<ReconciliationReport[]> {
    const [offChain, onChain] = await Promise.all([
      this.snapshotOffChain(),
      this.snapshotOnChain(),
    ]);

    const discrepancies: ReconciliationReport[] = [];

    discrepancies.push(...(await this.comparePatientCount(offChain, onChain)));
    discrepancies.push(...(await this.compareProviderList(offChain, onChain)));
    discrepancies.push(...(await this.compareRecordCounts(offChain, onChain)));

    const irreconcilable = discrepancies.filter(
      (d) => d.status === ReconciliationStatus.IRRECONCILABLE,
    );

    if (irreconcilable.length > 0) {
      await this.alertAdmin(irreconcilable);
    }

    this.logger.log(
      `Reconciliation complete — ${discrepancies.length} discrepancies found, ` +
        `${irreconcilable.length} irreconcilable`,
    );

    return discrepancies;
  }

  // ─── Off-chain Snapshot ────────────────────────────────────────────────────

  async snapshotOffChain(): Promise<OnChainState> {
    const [patientCount, records] = await Promise.all([
      this.patientRepo.count(),
      this.recordRepo.find({
        where: { status: MedicalRecordStatus.ACTIVE },
        select: ['patientId', 'providerId'],
      }),
    ]);

    const recordCountByPatient: Record<string, number> = {};
    const providerSet = new Set<string>();

    for (const r of records) {
      recordCountByPatient[r.patientId] = (recordCountByPatient[r.patientId] ?? 0) + 1;
      if (r.providerId) providerSet.add(r.providerId);
    }

    return {
      patientCount,
      providerList: [...providerSet].sort(),
      recordCountByPatient,
    };
  }

  // ─── On-chain Snapshot ─────────────────────────────────────────────────────

  async snapshotOnChain(): Promise<OnChainState> {
    try {
      const raw = await this.callContractReadOnly('get_state', []);
      const native = StellarSdk.scValToNative(raw) as {
        patient_count?: number;
        provider_list?: string[];
        record_counts?: Record<string, number>;
      };

      return {
        patientCount: Number(native?.patient_count ?? 0),
        providerList: (native?.provider_list ?? []).sort(),
        recordCountByPatient: native?.record_counts ?? {},
      };
    } catch (err: any) {
      this.logger.warn(`On-chain snapshot failed, using empty state: ${err?.message}`);
      return { patientCount: 0, providerList: [], recordCountByPatient: {} };
    }
  }

  // ─── Comparison Methods ────────────────────────────────────────────────────

  private async comparePatientCount(
    off: OnChainState,
    on: OnChainState,
  ): Promise<ReconciliationReport[]> {
    if (off.patientCount === on.patientCount) return [];

    const report = await this.saveReport({
      discrepancyType: DiscrepancyType.PATIENT_COUNT_MISMATCH,
      offChainSnapshot: { patientCount: off.patientCount },
      onChainSnapshot: { patientCount: on.patientCount },
      status: ReconciliationStatus.IRRECONCILABLE, // count mismatch needs manual review
      adminNote: `Off-chain: ${off.patientCount}, on-chain: ${on.patientCount}`,
    });

    return [report];
  }

  private async compareProviderList(
    off: OnChainState,
    on: OnChainState,
  ): Promise<ReconciliationReport[]> {
    const offSet = new Set(off.providerList);
    const onSet = new Set(on.providerList);
    const missing = on.providerList.filter((p) => !offSet.has(p));
    const extra = off.providerList.filter((p) => !onSet.has(p));

    if (missing.length === 0 && extra.length === 0) return [];

    const reports: ReconciliationReport[] = [];

    // Extra cached providers not on-chain → safe to flag, no auto-repair needed
    if (extra.length > 0) {
      reports.push(
        await this.saveReport({
          discrepancyType: DiscrepancyType.PROVIDER_LIST_MISMATCH,
          offChainSnapshot: { extraProviders: extra },
          onChainSnapshot: { providerList: on.providerList },
          status: ReconciliationStatus.IRRECONCILABLE,
          adminNote: `Providers in DB not found on-chain: ${extra.join(', ')}`,
        }),
      );
    }

    return reports;
  }

  private async compareRecordCounts(
    off: OnChainState,
    on: OnChainState,
  ): Promise<ReconciliationReport[]> {
    const reports: ReconciliationReport[] = [];
    const allPatients = new Set([
      ...Object.keys(off.recordCountByPatient),
      ...Object.keys(on.recordCountByPatient),
    ]);

    for (const patientId of allPatients) {
      const offCount = off.recordCountByPatient[patientId] ?? 0;
      const onCount = on.recordCountByPatient[patientId] ?? 0;

      if (offCount === onCount) continue;

      // Missing off-chain record (on-chain has more) → safe auto-repair: flag for re-sync
      if (onCount > offCount) {
        const report = await this.saveReport({
          discrepancyType: DiscrepancyType.MISSING_ONCHAIN_RECORD,
          patientId,
          offChainSnapshot: { recordCount: offCount },
          onChainSnapshot: { recordCount: onCount },
          status: ReconciliationStatus.REPAIRED,
          repairAction: `Flagged patient ${patientId} for record re-sync from on-chain`,
        });
        reports.push(report);
        this.logger.warn(`Auto-repair: patient ${patientId} flagged for re-sync`);
        continue;
      }

      // Extra cached data (off-chain has more) → safe auto-repair: mark stale
      if (offCount > onCount) {
        const report = await this.saveReport({
          discrepancyType: DiscrepancyType.EXTRA_CACHED_DATA,
          patientId,
          offChainSnapshot: { recordCount: offCount },
          onChainSnapshot: { recordCount: onCount },
          status: ReconciliationStatus.REPAIRED,
          repairAction: `Excess off-chain records for patient ${patientId} marked for review`,
        });
        reports.push(report);
        this.logger.warn(`Auto-repair: excess cached records for patient ${patientId}`);
      }
    }

    return reports;
  }

  // ─── Admin Alert ───────────────────────────────────────────────────────────

  private async alertAdmin(reports: ReconciliationReport[]): Promise<void> {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL', 'admin@healthystellar.io');
    const summary = reports
      .map((r) => `• [${r.discrepancyType}] ${r.adminNote ?? r.patientId ?? ''}`)
      .join('\n');

    try {
      await this.notifications.sendEmail(
        adminEmail,
        `[ALERT] ${reports.length} Irreconcilable Discrepancies Found`,
        'reconciliation-alert',
        { count: reports.length, summary, runAt: new Date().toISOString() },
      );
    } catch (err: any) {
      this.logger.error(`Failed to send admin alert email: ${err?.message}`);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async saveReport(
    data: Partial<ReconciliationReport>,
  ): Promise<ReconciliationReport> {
    return this.reportRepo.save(this.reportRepo.create(data));
  }

  private async callContractReadOnly(
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<StellarSdk.xdr.ScVal> {
    const horizonUrl =
      this.config.get('STELLAR_NETWORK') === 'mainnet'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org';

    const horizon = new StellarSdk.Horizon.Server(horizonUrl, { allowHttp: false });
    const account = await horizon.loadAccount(this.sourceKeypair.publicKey());
    const contract = new StellarSdk.Contract(this.contractId);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '10000000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (StellarSdk.SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Contract simulation error: ${sim.error}`);
    }

    const retval = (sim as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse)
      .result?.retval;
    if (!retval) throw new Error('No return value from contract simulation');
    return retval;
  }
}
