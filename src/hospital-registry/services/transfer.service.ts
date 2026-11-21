import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PatientTransfer, TransferStatus, ReceiptStatus } from '../entities/patient-transfer.entity';
import { HospitalRegistry } from '../entities/hospital-registry.entity';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { AcceptTransferDto } from '../dto/accept-transfer.dto';
import { MedicalRecordsService } from '../../medical-records/services/medical-records.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StellarService } from '../../stellar/services/stellar.service';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    @InjectRepository(PatientTransfer)
    private readonly transferRepo: Repository<PatientTransfer>,
    @InjectRepository(HospitalRegistry)
    private readonly hospitalRepo: Repository<HospitalRegistry>,
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly accessControlService: AccessControlService,
    private readonly notificationsService: NotificationsService,
    private readonly stellarService: StellarService,
    private readonly configService: ConfigService,
  ) {}

  async initiateTransfer(dto: CreateTransferDto, initiatedBy: string, fromHospitalId: string): Promise<PatientTransfer> {
    const toHospital = await this.hospitalRepo.findOne({
      where: { id: dto.toHospitalId },
    });
    if (!toHospital) {
      throw new NotFoundException('Receiving hospital not found');
    }

    const existingPending = await this.transferRepo.findOne({
      where: {
        patientId: dto.patientId,
        status: TransferStatus.PENDING,
      },
    });
    if (existingPending) {
      throw new ConflictException('Patient already has a pending transfer');
    }

    const transfer = this.transferRepo.create({
      patientId: dto.patientId,
      patientName: dto.patientName,
      fromHospitalId,
      toHospitalId: dto.toHospitalId,
      transferReason: dto.transferReason,
      initiatedBy,
      sharedRecordIds: dto.recordIdsToShare ?? [],
      status: TransferStatus.PENDING,
    });

    const saved = await this.transferRepo.save(transfer);

    if (toHospital.email) {
      try {
        this.notificationsService.emitRecordUploaded(
          initiatedBy, saved.id, {
            targetUserId: toHospital.email,
            transferId: saved.id,
            patientName: dto.patientName,
            type: 'transfer_request',
          },
        );
      } catch (err) {
        this.logger.warn('Failed to send transfer notification: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    this.logger.log('Transfer ' + saved.id + ' initiated for patient ' + dto.patientId);
    return saved;
  }

  async acceptTransfer(transferId: string, dto: AcceptTransferDto): Promise<PatientTransfer> {
    const transfer = await this.transferRepo.findOne({
      where: { id: transferId },
      relations: ['fromHospital', 'toHospital'],
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Transfer is not in pending status');
    }

    transfer.status = TransferStatus.ACCEPTED;
    transfer.acceptedAt = new Date();
    transfer.acceptedBy = dto.acceptedBy;

    if (transfer.sharedRecordIds.length > 0) {
      for (const recordId of transfer.sharedRecordIds) {
        try {
          await this.medicalRecordsService.shareWithHospital(recordId, transfer.toHospitalId);
        } catch (err) {
          this.logger.warn('Failed to share record ' + recordId + ': ' + (err instanceof Error ? err.message : String(err)));
        }
      }
    }

    try {
      await this.accessControlService.revokeAccessByPatient(transfer.patientId, transfer.fromHospitalId);
    } catch (err) {
      this.logger.warn('Failed to revoke access: ' + (err instanceof Error ? err.message : String(err)));
    }

    transfer.status = TransferStatus.COMPLETED;
    transfer.completedAt = new Date();
    
    // Anchor transfer receipt on Stellar (or mark as NOT_ANCHORED until implemented)
    try {
      transfer.receiptStatus = ReceiptStatus.ANCHORING;
      const result = await this.anchorTransferReceipt(transfer);
      transfer.stellarTxHash = result;
      transfer.receiptStatus = ReceiptStatus.ANCHORED;
    } catch (err) {
      // If anchoring fails, store null with error status
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn('Failed to anchor transfer receipt: ' + errorMsg);
      transfer.stellarTxHash = null;
      transfer.receiptStatus = ReceiptStatus.NOT_ANCHORED;
      transfer.receiptError = errorMsg;
    }

    const saved = await this.transferRepo.save(transfer);

    await this.sendTransferNotifications(saved);

    this.logger.log(
      'Transfer ' + transferId + ' completed. Receipt status: ' + transfer.receiptStatus +
      (transfer.stellarTxHash ? ', Stellar tx: ' + transfer.stellarTxHash : ''),
    );
    return saved;
  }

  async getTransfer(transferId: string): Promise<PatientTransfer> {
    const transfer = await this.transferRepo.findOne({
      where: { id: transferId },
      relations: ['fromHospital', 'toHospital'],
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    return transfer;
  }

  async listTransfers(filters?: {
    patientId?: string;
    fromHospitalId?: string;
    toHospitalId?: string;
    status?: TransferStatus;
  }): Promise<PatientTransfer[]> {
    return this.transferRepo.find({
      where: filters ?? {},
      relations: ['fromHospital', 'toHospital'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Anchor transfer receipt on Stellar ledger
   *
   * Invokes StellarService to write the transfer metadata on-chain.
   * This creates an immutable, verifiable proof of the transfer.
   *
   * @param transfer Patient transfer record
   * @returns Stellar transaction hash
   * @throws Error if Stellar anchoring fails
   */
  private async anchorTransferReceipt(transfer: PatientTransfer): Promise<string> {
    this.logger.log(
      `[anchorTransferReceipt] Anchoring transfer ${transfer.id} ` +
      `from ${transfer.fromHospitalId} to ${transfer.toHospitalId}`,
    );

    try {
      // Invoke Stellar contract to anchor transfer metadata
      // The contract records: transfer ID, patient ID, from/to hospitals, timestamp
      const result = await this.stellarService.invokeContract(
        this.configService.get<string>('STELLAR_CONTRACT_ID'),
        'anchor_transfer',
        [
          // Transfer ID
          (await import('@stellar/stellar-sdk')).nativeToScVal(transfer.id, { type: 'string' }),
          // Patient ID
          (await import('@stellar/stellar-sdk')).nativeToScVal(transfer.patientId, { type: 'string' }),
          // From Hospital ID
          (await import('@stellar/stellar-sdk')).nativeToScVal(transfer.fromHospitalId, { type: 'string' }),
          // To Hospital ID
          (await import('@stellar/stellar-sdk')).nativeToScVal(transfer.toHospitalId, { type: 'string' }),
          // Transfer timestamp
          (await import('@stellar/stellar-sdk')).nativeToScVal(transfer.completedAt.getTime(), { type: 'u64' }),
        ],
      );

      this.logger.log(
        `[anchorTransferReceipt] Successfully anchored transfer ${transfer.id} ` +
        `on Stellar. Tx hash: ${result.txHash}`,
      );

      return result.txHash;
    } catch (error) {
      this.logger.error(
        `[anchorTransferReceipt] Failed to anchor transfer ${transfer.id}: ` +
        (error instanceof Error ? error.message : String(error)),
      );
      throw error;
    }
  }

  private async writeStellarTransferReceipt(transfer: PatientTransfer): Promise<string> {
    const simulatedHash = 'sim-' + transfer.id.replace(/-/g, '').substring(0, 32);
    this.logger.log('Stellar transfer receipt simulated: ' + simulatedHash);
    return simulatedHash;
  }

  private async sendTransferNotifications(transfer: PatientTransfer): Promise<void> {
    const emails: string[] = [];
    if (transfer.fromHospital?.email) emails.push(transfer.fromHospital.email);
    if (transfer.toHospital?.email) emails.push(transfer.toHospital.email);

    for (const email of emails) {
      try {
        this.notificationsService.emitRecordUploaded(
          'system', transfer.id, {
            targetUserId: email,
            transferId: transfer.id,
            patientName: transfer.patientName,
            type: 'transfer_completed',
            stellarTxHash: transfer.stellarTxHash,
          },
        );
      } catch (err) {
        this.logger.warn('Failed to send notification to ' + email + ': ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  }
}
