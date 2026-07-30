import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import { QUEUE_NAMES } from '../queue.constants';
import { PharmacyInventory } from '../../pharmacy/entities/pharmacy-inventory.entity';
import { PharmacyReorderAlertSuppression } from '../../pharmacy/entities/pharmacy-reorder-alert-suppression.entity';

export interface PharmacyReorderAlertJobData {
    drugId: string;
    inventoryId?: string;
    reorderLevel: number;
    reorderQuantity: number;
    currentQuantity: number;
    replenishedAt?: string | null;
    timestamp: string;
}

@Processor(QUEUE_NAMES.PHARMACY_REORDER_ALERTS)
export class PharmacyReorderAlertProcessor extends WorkerHost {
    private readonly logger = new Logger(PharmacyReorderAlertProcessor.name);

    constructor(
        @InjectRepository(PharmacyInventory)
        private readonly inventoryRepository: Repository<PharmacyInventory>,

        @InjectRepository(PharmacyReorderAlertSuppression)
        private readonly suppressionRepository: Repository<PharmacyReorderAlertSuppression>,
    ) {
        super();
    }

    async process(job: Job<PharmacyReorderAlertJobData>): Promise<void> {
        const { drugId } = job.data;

        const inventoryItems = await this.inventoryRepository.find({
            where: { drugId, status: 'available' },
            relations: ['drug'],
        });

        const totalQuantity = inventoryItems.reduce((sum, it) => sum + it.quantity, 0);

        // If stock is already replenished above threshold, don't alert.
        // (This also prevents alerts that were queued right before a restock.)
        if (totalQuantity > job.data.reorderLevel) {
            this.logger.log(
                `[PharmacyReorderAlert] Skip alert: drug ${drugId} is back above threshold. qty=${totalQuantity} threshold=${job.data.reorderLevel}`,
            );
            await this.setSuppressionOff(drugId);
            return;
        }

        const suppression = await this.suppressionRepository.findOne({ where: { drugId } });
        const isSuppressed = suppression?.isSuppressed ?? false;

        if (isSuppressed) {
            this.logger.log(
                `[PharmacyReorderAlert] Suppressed duplicate alert for drug ${drugId} (qty=${totalQuantity})`,
            );
            return;
        }

        await this.sendManagerAlert(job.data, totalQuantity);

        if (suppression) {
            suppression.lastAlertedAt = new Date(job.data.timestamp);
            suppression.isSuppressed = true;
            await this.suppressionRepository.save(suppression);
        } else {
            await this.suppressionRepository.save({
                drugId,
                lastAlertedAt: new Date(job.data.timestamp),
                isSuppressed: true,
            });
        }
    }

    private async setSuppressionOff(drugId: string): Promise<void> {
        const suppression = await this.suppressionRepository.findOne({ where: { drugId } });
        if (!suppression) return;

        if (suppression.isSuppressed) {
            suppression.isSuppressed = false;
            await this.suppressionRepository.save(suppression);
        }
    }

    private async sendManagerAlert(
        data: PharmacyReorderAlertJobData,
        totalQuantity: number,
    ): Promise<void> {
        // In this codebase, the notifications system is oriented around clinical notifications.
        // For acceptance criteria, we enqueue an alert job and then simulate the manager alert.
        // This processor is the single place where we would wire a real manager notification.

        const drugName = data.drugId; // fallback; we can enrich if needed

        this.logger.warn(
            `[PHARMACY REORDER ALERT] drug=${drugName} drugId=${data.drugId} qty=${totalQuantity} threshold=${data.reorderLevel} reorderQuantity=${data.reorderQuantity}`,
        );

        // TODO: replace with real manager notification (email/websocket) if a manager notification channel exists.
    }
}

