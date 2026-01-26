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
      order: { expirationDate: 'ASC' }
    });
  }

  async getTotalQuantity(drugId: string): Promise<number> {
    const inventories = await this.inventoryRepository.find({
      where: { 
        drugId,
        status: 'available'
      }
    });

    return inventories.reduce((total, inv) => total + inv.quantity, 0);
  }

  async updateInventory(id: string, updateDto: UpdateInventoryDto): Promise<PharmacyInventory> {
    const inventory = await this.inventoryRepository.findOne({ where: { id } });

    if (!inventory) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }

    Object.assign(inventory, updateDto);

    // Auto-update status based on quantity and expiration
    if (inventory.quantity <= 0) {
      inventory.status = 'out-of-stock';
    } else if (inventory.quantity <= inventory.reorderLevel) {
      inventory.status = 'low-stock';
    } else if (new Date(inventory.expirationDate) < new Date()) {
      inventory.status = 'expired';
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
        status: 'available'
      },
      order: { expirationDate: 'ASC' }
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
      throw new BadRequestException(`Insufficient inventory for drug ${drugId}. Short by ${remainingQuantity} units.`);
    }
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
        status: 'available'
      },
      relations: ['drug']
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
}