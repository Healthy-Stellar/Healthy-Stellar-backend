/**
 * Supported data residency regions
 * These regions define where patient data can be stored and processed
 */
export enum DataResidencyRegion {
  EU = 'EU',
  US = 'US',
  APAC = 'APAC',
  AFRICA = 'AFRICA',
}

/**
 * Compliance frameworks by region
 */
export enum ComplianceFramework {
  GDPR = 'GDPR', // EU
  HIPAA = 'HIPAA', // US
  POPIA = 'POPIA', // Africa
  PDPA = 'PDPA', // APAC (Singapore)
}

/**
 * Regional compliance mappings
 */
export const REGION_COMPLIANCE_MAPPING: Record<
  DataResidencyRegion,
  ComplianceFramework[]
> = {
  [DataResidencyRegion.EU]: [ComplianceFramework.GDPR],
  [DataResidencyRegion.US]: [ComplianceFramework.HIPAA],
  [DataResidencyRegion.AFRICA]: [ComplianceFramework.POPIA],
  [DataResidencyRegion.APAC]: [ComplianceFramework.PDPA],
};
