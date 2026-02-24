import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientCounselingLog } from '../entities/patient-counseling-log.entity';
import { Prescription } from '../entities/prescription.entity';

export interface CounselingSessionDto {
  prescriptionId: string;
  patientId: string;
  patientName: string;
  pharmacistId: string;
  pharmacistName: string;
  pharmacistLicense: string;
  counselingTopics: string[];
  durationMinutes: number;
  counselingNotes?: string;
  patientQuestions?: string;
  patientUnderstood: boolean;
  patientSignature?: string;
  status: 'completed' | 'refused' | 'deferred';
  refusalReason?: string;
}

@Injectable()
export class PatientCounselingService {
  constructor(
    @InjectRepository(PatientCounselingLog)
    private counselingRepository: Repository<PatientCounselingLog>,
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
  ) {}

  async logCounselingSession(sessionDto: CounselingSessionDto): Promise<PatientCounselingLog> {
    // Verify prescription exists
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: sessionDto.prescriptionId },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription ${sessionDto.prescriptionId} not found`);
    }

    const counselingLog = this.counselingRepository.create(sessionDto);
    return await this.counselingRepository.save(counselingLog);
  }

  async getCounselingHistory(patientId: string): Promise<PatientCounselingLog[]> {
    return await this.counselingRepository.find({
      where: { patientId },
      relations: ['prescription'],
      order: { counselingDate: 'DESC' },
    });
  }

  async getCounselingByPrescription(prescriptionId: string): Promise<PatientCounselingLog[]> {
    return await this.counselingRepository.find({
      where: { prescriptionId },
      order: { counselingDate: 'DESC' },
    });
  }

  async isPrescriptionCounseled(prescriptionId: string): Promise<boolean> {
    const counselingLog = await this.counselingRepository.findOne({
      where: {
        prescriptionId,
        status: 'completed',
      },
    });

    return !!counselingLog;
  }

  async getRequiredCounselingTopics(prescriptionId: string): Promise<string[]> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['items', 'items.drug'],
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription ${prescriptionId} not found`);
    }

    const topics = new Set<string>();

    // Standard counseling topics
    topics.add('Medication Purpose');
    topics.add('Dosing Instructions');
    topics.add('Administration Route');
    topics.add('Duration of Therapy');

    for (const item of prescription.items) {
      const drug = item.drug;

      // Add controlled substance counseling
      if (drug.controlledSubstanceSchedule !== 'non-controlled') {
        topics.add('Controlled Substance Precautions');
        topics.add('Storage and Security');
      }

      // Add refrigeration counseling
      if (drug.isRefrigerated) {
        topics.add('Refrigeration Requirements');
      }

      // Add hazardous drug counseling
      if (drug.isHazardous) {
        topics.add('Hazardous Drug Handling');
        topics.add('Special Precautions');
      }

      // Add side effects counseling
      if (drug.sideEffects) {
        topics.add('Common Side Effects');
        topics.add('When to Contact Provider');
      }

      // Add contraindication counseling
      if (drug.contraindications && drug.contraindications.length > 0) {
        topics.add('Contraindications and Warnings');
      }
    }

    return Array.from(topics);
  }

  async validateCounselingCompletion(prescriptionId: string): Promise<{
    isRequired: boolean;
    isCompleted: boolean;
    requiredTopics: string[];
    completedTopics: string[];
    missingTopics: string[];
  }> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription ${prescriptionId} not found`);
    }

    const isRequired = prescription.requiresCounseling;
    const requiredTopics = await this.getRequiredCounselingTopics(prescriptionId);

    const counselingLogs = await this.getCounselingByPrescription(prescriptionId);
    const completedLogs = counselingLogs.filter((log) => log.status === 'completed');

    const completedTopics = new Set<string>();
    completedLogs.forEach((log) => {
      log.counselingTopics.forEach((topic) => completedTopics.add(topic));
    });

    const completedTopicsArray = Array.from(completedTopics);
    const missingTopics = requiredTopics.filter((topic) => !completedTopics.has(topic));

    return {
      isRequired,
      isCompleted: isRequired ? missingTopics.length === 0 : true,
      requiredTopics,
      completedTopics: completedTopicsArray,
      missingTopics,
    };
  }

  async getCounselingStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalSessions: number;
    completedSessions: number;
    refusedSessions: number;
    deferredSessions: number;
    averageDuration: number;
    topCounselingTopics: Array<{ topic: string; count: number }>;
  }> {
    let query = this.counselingRepository.createQueryBuilder('counseling');

    if (startDate && endDate) {
      query = query.where('counseling.counselingDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const sessions = await query.getMany();

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === 'completed').length;
    const refusedSessions = sessions.filter((s) => s.status === 'refused').length;
    const deferredSessions = sessions.filter((s) => s.status === 'deferred').length;

    const totalDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    // Count counseling topics
    const topicCounts = new Map<string, number>();
    sessions.forEach((session) => {
      session.counselingTopics.forEach((topic) => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    });

    const topCounselingTopics = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSessions,
      completedSessions,
      refusedSessions,
      deferredSessions,
      averageDuration,
      topCounselingTopics,
    };
  }
}
