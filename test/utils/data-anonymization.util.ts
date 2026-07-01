import { faker } from '@faker-js/faker';
import * as crypto from 'crypto';

/**
 * Data Anonymization Utilities for HIPAA-Compliant Testing
 * 
 * These utilities ensure that all test data is completely synthetic and anonymized.
 * No real patient data should ever be used in tests.
 */

export interface AnonymizationOptions {
  /** Use deterministic generation for reproducible tests */
  deterministic?: boolean;
  /** Seed for deterministic generation */
  seed?: number;
}

/**
 * Initialize faker with optional seed for deterministic data
 */
export function initializeFaker(options: AnonymizationOptions = {}): void {
  if (options.deterministic && options.seed !== undefined) {
    faker.seed(options.seed);
  }
}

/**
 * Generate a synthetic Medical Record Number (MRN)
 * Format: MRN-YYYYMMDD-XXXX (where XXXX is random)
 */
export function generateMRN(options: AnonymizationOptions = {}): string {
  initializeFaker(options);
  const date = faker.date.past({ years: 10 });
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = faker.string.numeric(4);
  return `MRN-${dateStr}-${random}`;
}

/**
 * Generate synthetic patient demographics
 */
export function generatePatientDemographics(options: AnonymizationOptions = {}) {
  initializeFaker(options);
  
  const sex = faker.helpers.arrayElement(['male', 'female', 'other', 'unknown'] as const);
  const firstName = sex === 'male' 
    ? faker.person.firstName('male')
    : sex === 'female'
    ? faker.person.firstName('female')
    : faker.person.firstName();
  
  const lastName = faker.person.lastName();
  const dateOfBirth = faker.date.birthdate({ min: 1, max: 100, mode: 'age' });
  
  return {
    mrn: generateMRN(options),
    firstName,
    lastName,
    middleName: faker.helpers.maybe(() => faker.person.middleName(), { probability: 0.5 }),
    dateOfBirth: dateOfBirth.toISOString().split('T')[0],
    sex,
    genderIdentity: faker.helpers.maybe(() => faker.helpers.arrayElement(['male', 'female', 'non-binary', 'prefer not to say'])),
    bloodGroup: faker.helpers.maybe(() => 
      faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const)
    ),
    knownAllergies: faker.helpers.maybe(() => 
      faker.helpers.arrayElements(['Penicillin', 'Latex', 'Peanuts', 'Shellfish', 'Aspirin'], { min: 0, max: 3 })
    ),
    primaryLanguage: faker.helpers.arrayElement(['English', 'Spanish', 'French', 'German', 'Chinese', 'Arabic']),
    nationality: faker.location.country(),
    ethnicity: faker.helpers.arrayElement(['Caucasian', 'African American', 'Hispanic', 'Asian', 'Other']),
    maritalStatus: faker.helpers.arrayElement(['single', 'married', 'divorced', 'widowed', 'other'] as const),
    phone: faker.phone.number(),
    email: faker.internet.email({ firstName, lastName }),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.location.zipCode(),
      country: faker.location.country(),
    },
    nationalId: `SSN-${faker.string.numeric(9)}`,
    nationalIdType: 'SSN',
    isAdmitted: faker.datatype.boolean(),
    isActive: true,
  };
}

/**
 * Anonymize existing patient data by replacing PHI fields
 */
export function anonymizePatientData<T extends Record<string, any>>(
  data: T,
  options: AnonymizationOptions = {}
): T {
  initializeFaker(options);
  
  // Use `any` cast so TypeScript doesn't complain about dynamic property access
  // on a generic type — these are intentional runtime field mutations.
  const anonymized: any = { ...data };
  
  // Anonymize name fields
  if (anonymized.firstName) anonymized.firstName = faker.person.firstName();
  if (anonymized.lastName) anonymized.lastName = faker.person.lastName();
  if (anonymized.middleName) anonymized.middleName = faker.person.middleName();
  
  // Anonymize contact information
  if (anonymized.email) anonymized.email = faker.internet.email();
  if (anonymized.phone) anonymized.phone = faker.phone.number();
  if (anonymized.address) {
    anonymized.address = {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.location.zipCode(),
      country: faker.location.country(),
    };
  }
  
  // Anonymize identifiers
  if (anonymized.nationalId) anonymized.nationalId = `SSN-${faker.string.numeric(9)}`;
  if (anonymized.mrn) anonymized.mrn = generateMRN(options);
  
  // Shift dates while preserving age relationships
  if (anonymized.dateOfBirth) {
    const originalDate = new Date(anonymized.dateOfBirth);
    const age = Math.floor((Date.now() - originalDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    anonymized.dateOfBirth = faker.date.birthdate({ min: age, max: age, mode: 'age' }).toISOString().split('T')[0];
  }
  
  return anonymized as T;
}

/**
 * Generate synthetic medical record data
 */
export function generateMedicalRecordData(patientId: string, options: AnonymizationOptions = {}) {
  initializeFaker(options);
  
  const recordTypes = ['consultation', 'diagnosis', 'treatment', 'lab_result', 'imaging', 'prescription', 'surgery', 'emergency', 'other'] as const;
  
  return {
    patientId,
    providerId: faker.string.uuid(),
    createdBy: faker.string.uuid(),
    recordType: faker.helpers.arrayElement(recordTypes),
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement(['active', 'archived', 'deleted'] as const),
    recordDate: faker.date.recent({ days: 365 }),
    metadata: {
      facility: faker.company.name(),
      department: faker.helpers.arrayElement(['Emergency', 'Cardiology', 'Neurology', 'Pediatrics', 'Surgery']),
      notes: faker.lorem.sentences(2),
    },
  };
}

/**
 * Validate that data does not contain real PHI patterns
 * This is a safety check to prevent accidental use of real data
 */
export function validateNoRealPHI(data: any): { isValid: boolean; violations: string[] } {
  const violations: string[] = [];
  const dataStr = JSON.stringify(data);
  
  // Check for real SSN patterns (XXX-XX-XXXX)
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  if (ssnPattern.test(dataStr) && !dataStr.includes('SSN-')) {
    violations.push('Potential real SSN detected');
  }
  
  // Check for real email domains (common providers)
  const realEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  realEmailDomains.forEach(domain => {
    if (dataStr.includes(`@${domain}`) && !dataStr.includes('example.com')) {
      violations.push(`Real email domain detected: ${domain}`);
    }
  });
  
  // Check for sequential IDs that might be real
  const sequentialIdPattern = /\b(MRN|SSN|ID)-?\d{1,5}\b/g;
  const matches = dataStr.match(sequentialIdPattern);
  if (matches && matches.some(m => {
    const num = parseInt(m.replace(/\D/g, ''));
    return num < 10000; // Suspiciously low numbers might be real
  })) {
    violations.push('Suspiciously simple ID detected - might be real data');
  }
  
  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Generate a deterministic but anonymized version of a string
 * Useful for consistent test data across runs
 */
export function deterministicAnonymize(input: string, salt: string = 'test-salt'): string {
  const hash = crypto.createHash('sha256').update(input + salt).digest('hex');
  return hash.substring(0, input.length);
}

/**
 * Shift dates by a random offset while preserving relative relationships
 */
export function shiftDate(date: Date, options: AnonymizationOptions = {}): Date {
  initializeFaker(options);
  const daysOffset = faker.number.int({ min: -365, max: 365 });
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + daysOffset);
  return shifted;
}

/**
 * Generate synthetic clinical notes
 */
export function generateClinicalNotes(options: AnonymizationOptions = {}): string {
  initializeFaker(options);
  
  const templates = [
    `Patient presents with ${faker.lorem.words(3)}. Vital signs stable. ${faker.lorem.sentence()} Treatment plan: ${faker.lorem.sentence()}`,
    `Follow-up visit for ${faker.lorem.words(2)}. Patient reports ${faker.lorem.sentence()} No complications noted.`,
    `Emergency admission for ${faker.lorem.words(3)}. ${faker.lorem.sentence()} Immediate intervention required.`,
    `Routine checkup. Patient in good health. ${faker.lorem.sentence()} Continue current medications.`,
  ];
  
  return faker.helpers.arrayElement(templates);
}

/**
 * Batch anonymize an array of records
 */
export function batchAnonymize<T extends Record<string, any>>(
  records: T[],
  options: AnonymizationOptions = {}
): T[] {
  return records.map(record => anonymizePatientData(record, options));
}
