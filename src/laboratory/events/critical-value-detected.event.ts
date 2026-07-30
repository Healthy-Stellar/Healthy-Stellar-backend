export const CRITICAL_VALUE_DETECTED = 'laboratory.critical_value.detected';

export class CriticalValueDetectedEvent {
  constructor(
    public readonly alertId: string,
    public readonly resultValueId: string,
    public readonly providerId: string,
    public readonly testName: string,
    public readonly value: number,
    public readonly unit: string,
    public readonly patientId: string,
  ) {}
}
