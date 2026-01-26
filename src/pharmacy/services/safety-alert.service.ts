import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafetyAlert } from '../entities/safety-alert.entity';
import { Prescription } from '../entities/prescription.entity';
import { Drug } from '../entities/drug.entity';
import { DrugInteractionService } from './drug-interaction.service';

@Injectable()
export class SafetyAlertService {
  constructor(
    @InjectRepository(SafetyAlert)
    private alertRepository: Repository<SafetyAlert>,
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
    private drugInteractionService: DrugInteractionService,
  ) {}

  async generateAlertsForPrescription(prescription: Prescription): Promise<SafetyAlert[]> {
    const alerts: SafetyAlert[] = [];

    // Check drug interactions
    const drugIds = prescription.items.map(item => item.drugId);
    const interactionCheck = await this.drugInteractionService.checkInteractions(drugIds);

    if (interactionCheck.hasInteractions) {
      for (const interaction of interactionCheck.interactions) {
        const alert = this.alertRepository.create({
          prescriptionId: prescription.id,
          alertType: 'drug-interaction',
          severity: interaction.severity as any,
          message: `Interaction detected between ${interaction.drug1.genericName} and ${interaction.drug2.genericName}`,
          recommendation: interaction.management
        });
        alerts.push(alert);
      }
    }

    // Check allergies
    if (prescription.patientAllergies && prescription.patientAllergies.length > 0) {
      for (const item of prescription.items) {
        const drug = await this.drugRepository.findOne({ where: { id: item.drugId } });
        
        // Simple allergy check - in production, this would be more sophisticated
        const allergyMatch = prescription.patientAllergies.some(allergy => 
          drug.genericName.toLowerCase().includes(allergy.toLowerCase()) ||
          drug.brandName.toLowerCase().includes(allergy.toLowerCase())
        );

        if (allergyMatch) {
          const alert = this.alertRepository.create({
            prescriptionId: prescription.id,
            alertType: 'allergy',
            severity: 'critical',
            message: `Patient has documented allergy to ${drug.genericName}`,
            recommendation: 'Do not dispense. Contact prescriber immediately.'
          });
          alerts.push(alert);
        }
      }
    }

    // Check for duplicate therapy (same therapeutic class)
    const drugs = await this.drugRepository.find({
      where: { id: In(drugIds) }
    });

    const therapeuticClassMap = new Map<string, Drug[]>();
    drugs.forEach(drug => {
      if (drug.therapeuticClasses) {
        drug.therapeuticClasses.forEach(tc => {
          if (!therapeuticClassMap.has(tc)) {
            therapeuticClassMap.set(tc, []);
          }
          therapeuticClassMap.get(tc).push(drug);
        });
      }
    });

    therapeuticClassMap.forEach((drugsInClass, therapeuticClass) => {
      if (drugsInClass.length > 1) {
        const alert = this.alertRepository.create({
          prescriptionId: prescription.id,
          alertType: 'duplicate-therapy',
          severity: 'moderate',
          message: `Multiple drugs from therapeutic class "${therapeuticClass}" prescribed: ${drugsInClass.map(d => d.genericName).join(', ')}`,
          recommendation: 'Review for duplicate therapy. Verify with prescriber if intentional.'
        });
        alerts.push(alert);
      }
    });

    // Save all alerts
    if (alerts.length > 0) {
      return await this.alertRepository.save(alerts);
    }

    return [];
  }

  async getAlertsByPrescription(prescriptionId: string): Promise<SafetyAlert[]> {
    return await this.alertRepository.find({
      where: { prescriptionId },
      order: { severity: 'DESC', createdAt: 'DESC' }
    });
  }

  async acknowledgeAlert(alertId: string, pharmacistId: string, notes?: string): Promise<SafetyAlert> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId } });
    
    alert.acknowledged = true;
    alert.acknowledgedBy = pharmacistId;
    alert.acknowledgedAt = new Date();
    if (notes) {
      alert.pharmacistNotes = notes;
    }

    return await this.alertRepository.save(alert);
  }
}