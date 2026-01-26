import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DrugInteraction } from '../entities/drug-interaction.entity';

export interface InteractionCheck {
  hasInteractions: boolean;
  interactions: DrugInteraction[];
  severity: 'none' | 'minor' | 'moderate' | 'major' | 'contraindicated';
}

@Injectable()
export class DrugInteractionService {
  constructor(
    @InjectRepository(DrugInteraction)
    private interactionRepository: Repository<DrugInteraction>,
  ) {}

  async checkInteractions(drugIds: string[]): Promise<InteractionCheck> {
    if (drugIds.length < 2) {
      return {
        hasInteractions: false,
        interactions: [],
        severity: 'none'
      };
    }

    // Find all interactions between any pair of drugs in the list
    const interactions = await this.interactionRepository
      .createQueryBuilder('interaction')
      .leftJoinAndSelect('interaction.drug1', 'drug1')
      .leftJoinAndSelect('interaction.drug2', 'drug2')
      .where('interaction.drug1Id IN (:...drugIds)', { drugIds })
      .andWhere('interaction.drug2Id IN (:...drugIds)', { drugIds })
      .getMany();

    if (interactions.length === 0) {
      return {
        hasInteractions: false,
        interactions: [],
        severity: 'none'
      };
    }

    // Determine highest severity
    const severityOrder = ['none', 'minor', 'moderate', 'major', 'contraindicated'];
    const maxSeverity = interactions.reduce((max, interaction) => {
      const currentIndex = severityOrder.indexOf(interaction.severity);
      const maxIndex = severityOrder.indexOf(max);
      return currentIndex > maxIndex ? interaction.severity : max;
    }, 'none' as any);

    return {
      hasInteractions: true,
      interactions,
      severity: maxSeverity
    };
  }

  async getInteractionsBetween(drug1Id: string, drug2Id: string): Promise<DrugInteraction[]> {
    return await this.interactionRepository.find({
      where: [
        { drug1Id, drug2Id },
        { drug1Id: drug2Id, drug2Id: drug1Id }
      ],
      relations: ['drug1', 'drug2']
    });
  }
}