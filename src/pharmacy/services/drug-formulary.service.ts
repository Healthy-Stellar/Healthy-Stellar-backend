import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DrugFormulary, FormularyTier, FormularyStatus } from '../entities/drug-formulary.entity';

@Injectable()
export class DrugFormularyService {
  constructor(
    @InjectRepository(DrugFormulary)
    private formularyRepository: Repository<DrugFormulary>,
  ) {}

  async create(createDto: Partial<DrugFormulary>): Promise<DrugFormulary> {
    const formulary = this.formularyRepository.create(createDto);
    return await this.formularyRepository.save(formulary);
  }

  async findAll(): Promise<DrugFormulary[]> {
    return await this.formularyRepository.find({
      where: { isActive: true },
      relations: ['drug'],
      order: { insurancePlan: 'ASC', tier: 'ASC' },
    });
  }

  async findOne(id: string): Promise<DrugFormulary> {
    const formulary = await this.formularyRepository.findOne({
      where: { id, isActive: true },
      relations: ['drug'],
    });

    if (!formulary) {
      throw new NotFoundException(`Formulary entry ${id} not found`);
    }

    return formulary;
  }

  async findByDrugAndPlan(drugId: string, insurancePlan: string): Promise<DrugFormulary | null> {
    return await this.formularyRepository.findOne({
      where: {
        drugId,
        insurancePlan,
        isActive: true,
      },
      relations: ['drug'],
    });
  }

  async update(id: string, updateDto: Partial<DrugFormulary>): Promise<DrugFormulary> {
    const formulary = await this.findOne(id);
    Object.assign(formulary, updateDto);
    return await this.formularyRepository.save(formulary);
  }

  async remove(id: string): Promise<void> {
    const formulary = await this.findOne(id);
    formulary.isActive = false;
    await this.formularyRepository.save(formulary);
  }

  async getFormularyByPlan(insurancePlan: string): Promise<DrugFormulary[]> {
    return await this.formularyRepository.find({
      where: { insurancePlan, isActive: true },
      relations: ['drug'],
      order: { tier: 'ASC' },
    });
  }

  async getFormularyByTier(tier: FormularyTier): Promise<DrugFormulary[]> {
    return await this.formularyRepository.find({
      where: { tier, isActive: true },
      relations: ['drug'],
      order: { insurancePlan: 'ASC' },
    });
  }

  async checkCoverage(
    drugId: string,
    insurancePlan: string,
  ): Promise<{
    isCovered: boolean;
    tier?: FormularyTier;
    status?: FormularyStatus;
    copayAmount?: number;
    coinsurancePercent?: number;
    requiresPriorAuth: boolean;
    requiresStepTherapy: boolean;
    hasQuantityLimit: boolean;
    quantityLimit?: number;
    preferredAlternatives?: string[];
  }> {
    const formulary = await this.findByDrugAndPlan(drugId, insurancePlan);

    if (!formulary) {
      return {
        isCovered: false,
        requiresPriorAuth: false,
        requiresStepTherapy: false,
        hasQuantityLimit: false,
      };
    }

    return {
      isCovered: formulary.status !== FormularyStatus.NOT_COVERED,
      tier: formulary.tier,
      status: formulary.status,
      copayAmount: formulary.copayAmount,
      coinsurancePercent: formulary.coinsurancePercent,
      requiresPriorAuth: formulary.status === FormularyStatus.PRIOR_AUTH,
      requiresStepTherapy: formulary.status === FormularyStatus.STEP_THERAPY,
      hasQuantityLimit: formulary.status === FormularyStatus.QUANTITY_LIMIT,
      quantityLimit: formulary.quantityLimit,
      preferredAlternatives: formulary.preferredAlternatives,
    };
  }

  async calculatePatientCost(
    drugId: string,
    insurancePlan: string,
    quantity: number,
    drugCost: number,
  ): Promise<{
    totalCost: number;
    insurancePays: number;
    patientPays: number;
    copay?: number;
    coinsurance?: number;
    deductible?: number;
  }> {
    const formulary = await this.findByDrugAndPlan(drugId, insurancePlan);

    if (!formulary || formulary.status === FormularyStatus.NOT_COVERED) {
      return {
        totalCost: drugCost,
        insurancePays: 0,
        patientPays: drugCost,
      };
    }

    let patientPays = 0;
    let copay = 0;
    let coinsurance = 0;
    let deductible = 0;

    // Calculate copay
    if (formulary.copayAmount) {
      copay = formulary.copayAmount;
      patientPays += copay;
    }

    // Calculate coinsurance
    if (formulary.coinsurancePercent) {
      coinsurance = drugCost * (formulary.coinsurancePercent / 100);
      patientPays += coinsurance;
    }

    // Apply deductible if applicable
    if (formulary.deductibleAmount) {
      deductible = Math.min(formulary.deductibleAmount, drugCost);
      patientPays += deductible;
    }

    // Ensure patient doesn't pay more than total cost
    patientPays = Math.min(patientPays, drugCost);
    const insurancePays = drugCost - patientPays;

    return {
      totalCost: drugCost,
      insurancePays,
      patientPays,
      copay: copay > 0 ? copay : undefined,
      coinsurance: coinsurance > 0 ? coinsurance : undefined,
      deductible: deductible > 0 ? deductible : undefined,
    };
  }

  async getPreferredAlternatives(drugId: string, insurancePlan: string): Promise<DrugFormulary[]> {
    const formulary = await this.findByDrugAndPlan(drugId, insurancePlan);

    if (!formulary || !formulary.preferredAlternatives) {
      return [];
    }

    return await this.formularyRepository.find({
      where: {
        drugId: formulary.preferredAlternatives as any, // TypeORM In operator
        insurancePlan,
        isActive: true,
      },
      relations: ['drug'],
      order: { tier: 'ASC' },
    });
  }
}
