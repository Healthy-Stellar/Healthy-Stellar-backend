import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PharmacyInventory } from '../entities/pharmacy-inventory.entity';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';

@Injectable()
export class PharmacyInventoryService {
  constructor(
    @InjectRepository(PharmacyInventory)
    private inventoryRepository: Repository<PharmacyInventory>,
  ) {}

  async getInventoryByDrug(drugId: string): Promise<PharmacyInventory[]> {
    return await this.inventoryRepository.find({
      where: { drugId },
      relations: ['drug'],
      order: { expirationDate: 'ASC' },
    });
  }

  async getInventoryItem(id: string): Promise<PharmacyInventory> {
    const inventory = await this.inventoryRepository.findOne({
      where: { id },
      relations: ['drug'],
    });
    if (!inventory) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return inventory;
  }

  async getTotalQuantity(drugId: string): Promise<number> {
    const inventories = await this.inventoryRepository.find({
      where: {
        drugId,
        status: 'available',
      },
    });

    return inventories.reduce((total, inv) => total + inv.quantity, 0);
  }

  async updateInventory(id: string, updateDto: UpdateInventoryDto): Promise<PharmacyInventory> {
    const inventory = await this.getInventoryItem(id);

    Object.assign(inventory, updateDto);

    // Auto-update status based on quantity and expiration
    const isExpired = new Date(inventory.expirationDate) < new Date();
    if (inventory.isRecalled) {
      inventory.status = 'recalled';
    } else if (isExpired) {
      inventory.status = 'expired';
    } else if (inventory.quantity <= 0) {
      inventory.status = 'out-of-stock';
    } else if (inventory.quantity <= inventory.reorderLevel) {
      inventory.status = 'low-stock';
    } else {
      inventory.status = 'available';
    }

    return await this.inventoryRepository.save(inventory);
  }

  async deductInventory(drugId: string, quantity: number): Promise<void> {
    // Use FIFO (First Expired First Out) - get earliest expiring available inventory
    const inventories = await this.inventoryRepository.find({
      where: {
        drugId,
        status: 'available',
      },
      order: { expirationDate: 'ASC' },
    });

    let remainingQuantity = quantity;

    for (const inventory of inventories) {
      if (remainingQuantity <= 0) break;

      const deduction = Math.min(inventory.quantity, remainingQuantity);
      inventory.quantity -= deduction;
      remainingQuantity -= deduction;

      await this.updateInventory(inventory.id, { quantity: inventory.quantity });
    }

    if (remainingQuantity > 0) {
      throw new BadRequestException(
        `Insufficient inventory for drug ${drugId}. Short by ${remainingQuantity} units.`,
      );
    }
  }

  async deductInventoryItem(inventoryId: string, quantity: number): Promise<PharmacyInventory> {
    const inventory = await this.getInventoryItem(inventoryId);

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero.');
    }

    if (inventory.quantity < quantity) {
      throw new BadRequestException(
        `Insufficient inventory for item ${inventoryId}. Available ${inventory.quantity}, requested ${quantity}.`,
      );
    }

    inventory.quantity -= quantity;
    return this.updateInventory(inventory.id, { quantity: inventory.quantity });
  }

  async getLowStockItems(): Promise<PharmacyInventory[]> {
    return await this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.drug', 'drug')
      .where('inventory.quantity <= inventory.reorderLevel')
      .andWhere('inventory.status = :status', { status: 'available' })
      .getMany();
  }

  async getExpiredItems(): Promise<PharmacyInventory[]> {
    return await this.inventoryRepository.find({
      where: {
        expirationDate: LessThan(new Date()),
        status: 'available',
      },
      relations: ['drug'],
    });
  }

  async getExpiringItems(daysAhead: number = 90): Promise<PharmacyInventory[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.drug', 'drug')
      .where('inventory.expirationDate <= :futureDate', { futureDate })
      .andWhere('inventory.expirationDate > :now', { now: new Date() })
      .andWhere('inventory.status = :status', { status: 'available' })
      .orderBy('inventory.expirationDate', 'ASC')
      .getMany();
  }

  async addInventoryFromPurchase(purchaseData: {
    drugId: string;
    quantity: number;
    lotNumber: string;
    expirationDate: Date;
    unitCost: number;
    supplierId?: string;
    purchaseOrderNumber?: string;
    location?: string;
  }): Promise<PharmacyInventory> {
    const inventory = this.inventoryRepository.create({
      drugId: purchaseData.drugId,
      quantity: purchaseData.quantity,
      lotNumber: purchaseData.lotNumber,
      expirationDate: purchaseData.expirationDate,
      unitCost: purchaseData.unitCost,
      sellingPrice: purchaseData.unitCost * 1.2, // Default markup of 20%
      supplierId: purchaseData.supplierId,
      purchaseOrderNumber: purchaseData.purchaseOrderNumber,
      location: purchaseData.location || 'Main Pharmacy',
      status: 'available',
    });

    return this.inventoryRepository.save(inventory);
  }

  async getCostSummaryByDrug(drugId: string) {
    const inventories = await this.inventoryRepository.find({
      where: { drugId },
      relations: ['drug'],
    });

    if (!inventories.length) {
      throw new NotFoundException(`No inventory found for drug ${drugId}`);
    }

    const totalQuantity = inventories.reduce((total, inv) => total + inv.quantity, 0);
    const totalValue = inventories.reduce(
      (total, inv) => total + inv.quantity * Number(inv.unitCost),
      0,
    );
    const averageUnitCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    return {
      drugId,
      drugName: inventories[0].drug?.brandName,
      totalQuantity,
      totalValue,
      averageUnitCost,
    };
  }

  async getRecalledItems(): Promise<PharmacyInventory[]> {
    return this.inventoryRepository.find({
      where: { isRecalled: true },
      relations: ['drug'],
    });
  }

  async markAsRecalled(inventoryId: string, recallReason: string): Promise<PharmacyInventory> {
    const inventory = await this.inventoryRepository.findOne({ where: { id: inventoryId } });
    if (!inventory) {
      throw new NotFoundException(`Inventory item ${inventoryId} not found`);
    }

    inventory.isRecalled = true;
    inventory.recallReason = recallReason;
    inventory.recallDate = new Date();
    inventory.status = 'recalled';

    return this.inventoryRepository.save(inventory);
  }
}
