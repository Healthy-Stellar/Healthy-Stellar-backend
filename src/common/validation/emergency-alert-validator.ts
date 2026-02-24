import { Injectable } from '@nestjs/common';
import { EMERGENCY_ALERT_KEYWORDS } from './medical-validation.constants';

export interface EmergencyAlert {
  patientId: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  triggeredBy: string;
  timestamp: Date;
}

@Injectable()
export class EmergencyAlertValidator {
  validateAndProcessEmergencyAlert(data: any): EmergencyAlert | null {
    const text = (data.description || '').toUpperCase();

    const matchedKeyword = EMERGENCY_ALERT_KEYWORDS.find((keyword) => text.includes(keyword));

    if (!matchedKeyword) {
      return null;
    }

    const alert: EmergencyAlert = {
      patientId: data.patientId,
      alertType: matchedKeyword,
      severity: this.determineSeverity(matchedKeyword),
      description: data.description,
      triggeredBy: data.triggeredBy || 'SYSTEM',
      timestamp: new Date(),
    };

    return alert;
  }

  private determineSeverity(keyword: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalKeywords = ['MYOCARDIAL_INFARCTION', 'STROKE', 'SEPSIS', 'ANAPHYLAXIS'];

    return criticalKeywords.includes(keyword) ? 'CRITICAL' : 'HIGH';
  }

  isEmergencySituation(vitals: any): boolean {
    if (!vitals) return false;

    const criticalConditions = [
      vitals.heartRate < 40 || vitals.heartRate > 140,
      vitals.systolicBP < 90 || vitals.systolicBP > 180,
      vitals.respiratoryRate < 10 || vitals.respiratoryRate > 30,
      vitals.oxygenSaturation < 85,
      vitals.temperature < 35 || vitals.temperature > 40,
    ];

    return criticalConditions.some((condition) => condition === true);
  }
}
