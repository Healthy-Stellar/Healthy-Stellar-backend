/**
 * Maps LOINC codes (as carried in HL7 OBX-3.1) to this system's internal
 * lab test codes. Codes not present here fall back to the raw LOINC code
 * so unmapped results are still imported rather than rejected.
 */
export const LOINC_TO_INTERNAL_TEST_CODE: Record<string, string> = {
  '2823-3': 'POTASSIUM',
  '2160-0': 'CREATININE',
  '718-7': 'HGB',
  '2339-0': 'GLUCOSE',
  '6598-7': 'PT',
  '3016-3': 'TSH',
  '2951-2': 'SODIUM',
  '2075-0': 'CHLORIDE',
  '2028-9': 'CO2',
  '3094-0': 'BUN',
  '4548-4': 'HBA1C',
  '789-8': 'RBC',
  '6690-2': 'WBC',
  '777-3': 'PLT',
};

export function mapLoincToTestCode(loincCode: string): string {
  return LOINC_TO_INTERNAL_TEST_CODE[loincCode] ?? loincCode;
}
