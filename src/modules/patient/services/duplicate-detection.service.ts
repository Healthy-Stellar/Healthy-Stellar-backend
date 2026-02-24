import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { PatientDuplicate } from '../entities/patient-duplicate.entity';
import levenshtein from 'fast-levenshtein';

interface DuplicateMatch {
  patient: Patient;
  score: number;
  matchingFields: string[];
}

@Injectable()
export class DuplicateDetectionService {
  private readonly THRESHOLD = 70; // Similarity threshold (0-100)

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientDuplicate)
    private readonly duplicateRepository: Repository<PatientDuplicate>,
  ) {}

  /**
   * Find potential duplicates for a patient
   */
  async findPotentialDuplicates(patientData: Partial<Patient>): Promise<DuplicateMatch[]> {
    const candidates: Patient[] = [];

    // Search by exact matches first
    if (patientData.nationalId) {
      const byNationalId = await this.patientRepository.find({
        where: { nationalId: patientData.nationalId },
      });
      candidates.push(...byNationalId);
    }

    if (patientData.email) {
      const byEmail = await this.patientRepository.find({
        where: { email: patientData.email },
      });
      candidates.push(...byEmail);
    }

    if (patientData.phoneNumber) {
      const byPhone = await this.patientRepository.find({
        where: { phoneNumber: patientData.phoneNumber },
      });
      candidates.push(...byPhone);
    }

    // Search by name and DOB similarity
    const byNameDob = await this.patientRepository
      .createQueryBuilder('patient')
      .where('patient.dateOfBirth = :dob', { dob: patientData.dateOfBirth })
      .andWhere(
        '(LOWER(patient.firstName) LIKE :firstName OR LOWER(patient.lastName) LIKE :lastName)',
        {
          firstName: `%${patientData.firstName?.toLowerCase()}%`,
          lastName: `%${patientData.lastName?.toLowerCase()}%`,
        },
      )
      .getMany();

    candidates.push(...byNameDob);

    // Remove duplicates and calculate scores
    const uniqueCandidates = Array.from(new Map(candidates.map((c) => [c.id, c])).values());

    const matches: DuplicateMatch[] = uniqueCandidates
      .map((candidate) => {
        const score = this.calculateSimilarityScore(patientData, candidate);
        const matchingFields = this.getMatchingFields(patientData, candidate);

        return {
          patient: candidate,
          score,
          matchingFields,
        };
      })
      .filter((match) => match.score >= this.THRESHOLD)
      .sort((a, b) => b.score - a.score);

    // Log potential duplicates
    for (const match of matches) {
      await this.logPotentialDuplicate(patientData.id, match.patient.id, match.score);
    }

    return matches;
  }

  /**
   * Calculate similarity score between two patients
   */
  private calculateSimilarityScore(patient1: Partial<Patient>, patient2: Patient): number {
    let totalScore = 0;
    let weightSum = 0;

    // Name similarity (weight: 30)
    if (patient1.firstName && patient2.firstName) {
      const firstNameSimilarity = this.stringSimilarity(patient1.firstName, patient2.firstName);
      totalScore += firstNameSimilarity * 15;
      weightSum += 15;
    }

    if (patient1.lastName && patient2.lastName) {
      const lastNameSimilarity = this.stringSimilarity(patient1.lastName, patient2.lastName);
      totalScore += lastNameSimilarity * 15;
      weightSum += 15;
    }

    // Date of birth (weight: 25)
    if (patient1.dateOfBirth && patient2.dateOfBirth) {
      const dobMatch =
        new Date(patient1.dateOfBirth).getTime() === new Date(patient2.dateOfBirth).getTime();
      totalScore += dobMatch ? 25 : 0;
      weightSum += 25;
    }

    // Phone number (weight: 20)
    if (patient1.phoneNumber && patient2.phoneNumber) {
      const phoneMatch = patient1.phoneNumber === patient2.phoneNumber;
      totalScore += phoneMatch ? 20 : 0;
      weightSum += 20;
    }

    // Email (weight: 15)
    if (patient1.email && patient2.email) {
      const emailMatch = patient1.email.toLowerCase() === patient2.email.toLowerCase();
      totalScore += emailMatch ? 15 : 0;
      weightSum += 15;
    }

    // National ID (weight: 10)
    if (patient1.nationalId && patient2.nationalId) {
      const idMatch = patient1.nationalId === patient2.nationalId;
      totalScore += idMatch ? 10 : 0;
      weightSum += 10;
    }

    return weightSum > 0 ? (totalScore / weightSum) * 100 : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private stringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    const maxLength = Math.max(s1.length, s2.length);

    if (maxLength === 0) return 1;

    const distance = levenshtein.get(s1, s2);
    return 1 - distance / maxLength;
  }

  /**
   * Get matching fields between two patients
   */
  private getMatchingFields(patient1: Partial<Patient>, patient2: Patient): string[] {
    const matches: string[] = [];

    if (patient1.firstName?.toLowerCase() === patient2.firstName.toLowerCase()) {
      matches.push('firstName');
    }
    if (patient1.lastName?.toLowerCase() === patient2.lastName.toLowerCase()) {
      matches.push('lastName');
    }
    if (
      patient1.dateOfBirth &&
      new Date(patient1.dateOfBirth).getTime() === new Date(patient2.dateOfBirth).getTime()
    ) {
      matches.push('dateOfBirth');
    }
    if (patient1.phoneNumber === patient2.phoneNumber) {
      matches.push('phoneNumber');
    }
    if (patient1.email?.toLowerCase() === patient2.email?.toLowerCase()) {
      matches.push('email');
    }
    if (patient1.nationalId === patient2.nationalId) {
      matches.push('nationalId');
    }

    return matches;
  }

  /**
   * Log a potential duplicate
   */
  private async logPotentialDuplicate(
    patient1Id: string,
    patient2Id: string,
    score: number,
  ): Promise<void> {
    const existing = await this.duplicateRepository.findOne({
      where: [
        { patient1Id, patient2Id },
        { patient1Id: patient2Id, patient2Id: patient1Id },
      ],
    });

    if (!existing) {
      await this.duplicateRepository.save({
        patient1Id,
        patient2Id,
        similarityScore: score,
        matchingFields: {},
        status: 'pending',
      });
    }
  }
}
