import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drug } from '../entities/drug.entity';
import { Prescription } from '../entities/prescription.entity';
import { DrugInteractionService } from './drug-interaction.service';

@Injectable()
export class PharmacyService {
  constructor(
    @InjectRepository(Drug)
    private readonly drugRepository: Repository<Drug>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    private readonly drugInteractionService: DrugInteractionService,
  ) {}

  async addDrug(dto: any) {
    try {
      const drug = this.drugRepository.create(dto);
      const savedDrug = await this.drugRepository.save(drug);
      return savedDrug;
    } catch (error) {
      throw new BadRequestException(`Failed to create drug: ${error.message}`);
    }
  }

  async checkInteractions(drugIds: string[], patientId: string) {
    try {
      // Use the existing DrugInteractionService which already handles local and OpenFDA checks
      const result = await this.drugInteractionService.checkInteractions(drugIds);
      
      return {
        safe: !result.hasInteractions,
        interactions: result.warnings,
        warnings: result.warnings,
        highestSeverity: result.highestSeverity,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to check drug interactions: ${error.message}`);
    }
  }

  async fillPrescription(id: string, pharmacistId: string) {
    try {
      const prescription = await this.prescriptionRepository.findOne({
        where: { id },
      });
      
      if (!prescription) {
        throw new NotFoundException(`Prescription with ID ${id} not found`);
      }
      
      if (prescription.status !== 'pending') {
        throw new BadRequestException(`Prescription ${id} is not in pending state`);
      }
      
      prescription.status = 'filled';
      prescription.pharmacistId = pharmacistId;
      prescription.filledDate = new Date();
      
      const updatedPrescription = await this.prescriptionRepository.save(prescription);
      return updatedPrescription;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fill prescription: ${error.message}`);
    }
  }
}
