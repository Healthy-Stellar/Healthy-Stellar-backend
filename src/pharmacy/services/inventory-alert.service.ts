import { Injectable, Logger } from '@nestjs/common';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { PurchaseOrderService } from './purchase-order.service';
import { DrugSupplierService } from './drug-supplier.service';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export interface InventoryAlert {
  type: 'low_stock' | 'expiring' | 'expired' | 'recalled' | 'reorder_needed';
  drugId: string;
  drugName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data?: any;
}

@Injectable()
export class InventoryAlertService {
  private readonly logger = new Logger(InventoryAlertService.name);

  constructor(
    private inventoryService: PharmacyInventoryService,
    private purchaseOrderService: PurchaseOrderService,
    private supplierService: DrugSupplierService,
  ) {}

  /**
   * Check inventory levels and generate alerts
   */
  async checkInventoryAlerts() {
    this.logger.log('Running inventory alert check...');

    const alerts: InventoryAlert[] = [];

    // Check low stock items
    const lowStockItems = await this.inventoryService.getLowStockItems();
    for (const item of lowStockItems) {
      alerts.push({
        type: 'low_stock',
        drugId: item.drugId,
        drugName: item.drug.brandName,
        message: `Low stock alert: ${item.drug.brandName} has ${item.quantity} units remaining (reorder at ${item.reorderLevel})`,
        severity: item.quantity === 0 ? 'critical' : 'medium',
        data: { currentQuantity: item.quantity, reorderLevel: item.reorderLevel },
      });
    }

    // Check expiring items (next 30 days)
    const expiringItems = await this.inventoryService.getExpiringItems(30);
    for (const item of expiringItems) {
      const daysUntilExpiry = Math.ceil(
        (new Date(item.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );

      alerts.push({
        type: 'expiring',
        drugId: item.drugId,
        drugName: item.drug.brandName,
        message: `Expiring soon: ${item.drug.brandName} (Lot: ${item.lotNumber}) expires in ${daysUntilExpiry} days`,
        severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
        data: { lotNumber: item.lotNumber, expirationDate: item.expirationDate, daysUntilExpiry },
      });
    }

    // Check expired items
    const expiredItems = await this.inventoryService.getExpiredItems();
    for (const item of expiredItems) {
      alerts.push({
        type: 'expired',
        drugId: item.drugId,
        drugName: item.drug.brandName,
        message: `Expired: ${item.drug.brandName} (Lot: ${item.lotNumber}) expired on ${item.expirationDate.toDateString()}`,
        severity: 'critical',
        data: { lotNumber: item.lotNumber, expirationDate: item.expirationDate },
      });
    }

    // Check recalled items
    const recalledItems = await this.inventoryService.getRecalledItems();
    for (const item of recalledItems) {
      alerts.push({
        type: 'recalled',
        drugId: item.drugId,
        drugName: item.drug.brandName,
        message: `Recalled: ${item.drug.brandName} (Lot: ${item.lotNumber}) - ${item.recallReason}`,
        severity: 'critical',
        data: { lotNumber: item.lotNumber, recallReason: item.recallReason },
      });
    }

    // Check items that need reordering
    const reorderNeeded = await this.getItemsNeedingReorder();
    for (const item of reorderNeeded) {
      alerts.push({
        type: 'reorder_needed',
        drugId: item.drugId,
        drugName: item.drugName,
        message: `Reorder needed: ${item.drugName} - Current: ${item.currentQuantity}, Reorder quantity: ${item.reorderQuantity}`,
        severity: 'medium',
        data: item,
      });
    }

    // Log alerts (in a real system, these would be sent via email/SMS/notifications)
    for (const alert of alerts) {
      this.logger.warn(`INVENTORY ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    }

    return alerts;
  }

  /**
   * Get items that need reordering based on current stock vs reorder levels
   */
  async getItemsNeedingReorder(): Promise<
    Array<{
      drugId: string;
      drugName: string;
      currentQuantity: number;
      reorderLevel: number;
      reorderQuantity: number;
    }>
  > {
    // This would typically query the database for drugs with low inventory
    // For now, we'll use the existing low stock logic
    const lowStockItems = await this.inventoryService.getLowStockItems();

    return lowStockItems.map((item) => ({
      drugId: item.drugId,
      drugName: item.drug.brandName,
      currentQuantity: item.quantity,
      reorderLevel: item.reorderLevel,
      reorderQuantity: item.reorderQuantity,
    }));
  }

  /**
   * Generate automatic purchase orders for items that need reordering
   */
  async generateAutomaticPurchaseOrders() {
    this.logger.log('Checking for automatic purchase orders...');

    const itemsNeedingReorder = await this.getItemsNeedingReorder();

    for (const item of itemsNeedingReorder) {
      const existingOrders = await this.purchaseOrderService.getOpenOrdersForDrug(item.drugId);
      const hasExistingOrder = existingOrders.length > 0;

      if (!hasExistingOrder) {
        const [inventoryItems, preferredSuppliers] = await Promise.all([
          this.inventoryService.getInventoryByDrug(item.drugId),
          this.supplierService.getPreferredSuppliers(),
        ]);

        const supplierId = inventoryItems.find((inv) => inv.supplierId)?.supplierId;
        const fallbackSupplierId = preferredSuppliers[0]?.id;

        if (!supplierId && !fallbackSupplierId) {
          this.logger.warn(`AUTO PURCHASE ORDER SKIPPED: No supplier on file for ${item.drugName}`);
          continue;
        }

        const unitCost = inventoryItems[0]?.unitCost || 0;
        await this.purchaseOrderService.create({
          supplierId: supplierId || fallbackSupplierId,
          status: PurchaseOrderStatus.PENDING,
          orderDate: new Date(),
          items: [
            {
              drugId: item.drugId,
              drugName: item.drugName,
              quantity: item.reorderQuantity,
              unitCost,
              totalCost: unitCost * item.reorderQuantity,
            },
          ],
          totalAmount: unitCost * item.reorderQuantity,
        });

        this.logger.log(
          `AUTO PURCHASE ORDER CREATED: ${item.drugName} - Quantity: ${item.reorderQuantity}`,
        );
      }
    }
  }

  /**
   * Get current inventory status summary
   */
  async getInventoryStatusSummary() {
    const [lowStockCount, expiringCount, expiredCount, recalledCount] = await Promise.all([
      this.inventoryService.getLowStockItems().then((items) => items.length),
      this.inventoryService.getExpiringItems(30).then((items) => items.length),
      this.inventoryService.getExpiredItems().then((items) => items.length),
      this.inventoryService.getRecalledItems().then((items) => items.length),
    ]);

    return {
      lowStockItems: lowStockCount,
      expiringItems: expiringCount,
      expiredItems: expiredCount,
      recalledItems: recalledCount,
      totalAlerts: lowStockCount + expiringCount + expiredCount + recalledCount,
    };
  }
}
