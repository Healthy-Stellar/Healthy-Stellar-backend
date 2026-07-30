export enum PrescriptionValidationErrorCode {
  DEA_NUMBER_REQUIRED = 'DEA_NUMBER_REQUIRED',
  SCHEDULE_II_NO_REFILLS = 'SCHEDULE_II_NO_REFILLS',
  SCHEDULE_II_EXPIRED = 'SCHEDULE_II_EXPIRED',
  PDMP_FLAG = 'PDMP_FLAG',
}

export class PrescriptionValidationError {
  constructor(
    public readonly code: PrescriptionValidationErrorCode,
    public readonly description: string,
    public readonly severity: 'major' | 'critical' = 'critical',
  ) {}
}
