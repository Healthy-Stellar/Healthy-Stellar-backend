/**
 * Test Data Factory
 * 
 * Provides factory functions for creating test data with sensible defaults.
 * Uses builder pattern for flexible test data creation.
 */

import { faker } from '@faker-js/faker';
import { generatePatientDemographics, generateMedicalRecordData } from '../utils/data-anonymization.util';

/**
 * Factory options for deterministic data generation
 */
export interface FactoryOptions {
  deterministic?: boolean;
  seed?: number;
}

/**
 * Initialize faker with options
 */
function initFaker(options: FactoryOptions = {}) {
  if (options.deterministic && options.seed !== undefined) {
    faker.seed(options.seed);
  }
}

/**
 * User Factory
 */
export class UserFactory {
  private data: any = {};

  constructor(private options: FactoryOptions = {}) {
    initFaker(options);
    this.data = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      password: 'Test123!@#',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: 'DOCTOR',
      isActive: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    };
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withRole(role: string): this {
    this.data.role = role;
    return this;
  }

  asAdmin(): this {
    this.data.role = 'ADMIN';
    return this;
  }

  asDoctor(): this {
    this.data.role = 'DOCTOR';
    return this;
  }

  asNurse(): this {
    this.data.role = 'NURSE';
    return this;
  }

  asPatient(): this {
    this.data.role = 'PATIENT';
    return this;
  }

  inactive(): this {
    this.data.isActive = false;
    return this;
  }

  build(): any {
    return { ...this.data };
  }

  static create(options?: FactoryOptions): any {
    return new UserFactory(options).build();
  }

  static createMany(count: number, options?: FactoryOptions): any[] {
    return Array.from({ length: count }, () => new UserFactory(options).build());
  }
}

/**
 * Patient Factory
 */
export class PatientFactory {
  private data: any = {};

  constructor(private options: FactoryOptions = {}) {
    initFaker(options);
    this.data = generatePatientDemographics(options);
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withMRN(mrn: string): this {
    this.data.mrn = mrn;
    return this;
  }

  withName(firstName: string, lastName: string): this {
    this.data.firstName = firstName;
    this.data.lastName = lastName;
    return this;
  }

  withDateOfBirth(dob: string): this {
    this.data.dateOfBirth = dob;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  admitted(): this {
    this.data.isAdmitted = true;
    return this;
  }

  discharged(): this {
    this.data.isAdmitted = false;
    return this;
  }

  inactive(): this {
    this.data.isActive = false;
    return this;
  }

  withAllergies(allergies: string[]): this {
    this.data.knownAllergies = allergies;
    return this;
  }

  withBloodGroup(bloodGroup: string): this {
    this.data.bloodGroup = bloodGroup;
    return this;
  }

  build(): any {
    return { ...this.data };
  }

  static create(options?: FactoryOptions): any {
    return new PatientFactory(options).build();
  }

  static createMany(count: number, options?: FactoryOptions): any[] {
    return Array.from({ length: count }, () => new PatientFactory(options).build());
  }
}

/**
 * Medical Record Factory
 */
export class RecordFactory {
  private data: any = {};

  constructor(private options: FactoryOptions = {}) {
    initFaker(options);
    this.data = {
      id: faker.string.uuid(),
      patientId: faker.string.uuid(),
      recordType: 'MEDICAL_REPORT',
      cid: 'Qm' + faker.string.alphanumeric(44),
      stellarTxHash: faker.string.alphanumeric(64),
      description: faker.lorem.sentence(),
      status: 'active',
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      createdBy: faker.string.uuid(),
      metadata: {},
    };
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withPatientId(patientId: string): this {
    this.data.patientId = patientId;
    return this;
  }

  withRecordType(recordType: string): this {
    this.data.recordType = recordType;
    return this;
  }

  asMedicalReport(): this {
    this.data.recordType = 'MEDICAL_REPORT';
    return this;
  }

  asLabResult(): this {
    this.data.recordType = 'LAB_RESULT';
    return this;
  }

  asImaging(): this {
    this.data.recordType = 'IMAGING';
    return this;
  }

  asPrescription(): this {
    this.data.recordType = 'PRESCRIPTION';
    return this;
  }

  withCID(cid: string): this {
    this.data.cid = cid;
    return this;
  }

  withStellarTxHash(hash: string): this {
    this.data.stellarTxHash = hash;
    return this;
  }

  withDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.createdAt = date;
    return this;
  }

  archived(): this {
    this.data.status = 'archived';
    return this;
  }

  deleted(): this {
    this.data.status = 'deleted';
    return this;
  }

  withMetadata(metadata: any): this {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    return this;
  }

  build(): any {
    return { ...this.data };
  }

  static create(options?: FactoryOptions): any {
    return new RecordFactory(options).build();
  }

  static createMany(count: number, options?: FactoryOptions): any[] {
    return Array.from({ length: count }, () => new RecordFactory(options).build());
  }
}

/**
 * Audit Log Factory
 */
export class AuditLogFactory {
  private data: any = {};

  constructor(private options: FactoryOptions = {}) {
    initFaker(options);
    this.data = {
      id: faker.string.uuid(),
      actorId: faker.string.uuid(),
      action: 'RECORD_READ',
      resourceId: faker.string.uuid(),
      resourceType: 'RECORD',
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      timestamp: faker.date.recent(),
      stellarTxHash: null,
      metadata: {},
    };
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withActorId(actorId: string): this {
    this.data.actorId = actorId;
    return this;
  }

  withAction(action: string): this {
    this.data.action = action;
    return this;
  }

  asRecordRead(): this {
    this.data.action = 'RECORD_READ';
    return this;
  }

  asRecordCreate(): this {
    this.data.action = 'RECORD_CREATE';
    return this;
  }

  asRecordUpdate(): this {
    this.data.action = 'RECORD_UPDATE';
    return this;
  }

  asAccessGrant(): this {
    this.data.action = 'ACCESS_GRANT';
    return this;
  }

  asAccessRevoke(): this {
    this.data.action = 'ACCESS_REVOKE';
    return this;
  }

  withResourceId(resourceId: string): this {
    this.data.resourceId = resourceId;
    return this;
  }

  withResourceType(resourceType: string): this {
    this.data.resourceType = resourceType;
    return this;
  }

  withStellarTxHash(hash: string): this {
    this.data.stellarTxHash = hash;
    return this;
  }

  withTimestamp(timestamp: Date): this {
    this.data.timestamp = timestamp;
    return this;
  }

  withMetadata(metadata: any): this {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    return this;
  }

  build(): any {
    return { ...this.data };
  }

  static create(options?: FactoryOptions): any {
    return new AuditLogFactory(options).build();
  }

  static createMany(count: number, options?: FactoryOptions): any[] {
    return Array.from({ length: count }, () => new AuditLogFactory(options).build());
  }
}

/**
 * Access Control Factory
 */
export class AccessControlFactory {
  private data: any = {};

  constructor(private options: FactoryOptions = {}) {
    initFaker(options);
    this.data = {
      id: faker.string.uuid(),
      patientId: faker.string.uuid(),
      grantedTo: faker.string.uuid(),
      grantedBy: faker.string.uuid(),
      recordId: faker.string.uuid(),
      permissions: ['READ'],
      expiresAt: faker.date.future(),
      createdAt: faker.date.past(),
      isActive: true,
    };
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withPatientId(patientId: string): this {
    this.data.patientId = patientId;
    return this;
  }

  withGrantedTo(userId: string): this {
    this.data.grantedTo = userId;
    return this;
  }

  withRecordId(recordId: string): this {
    this.data.recordId = recordId;
    return this;
  }

  withPermissions(permissions: string[]): this {
    this.data.permissions = permissions;
    return this;
  }

  readOnly(): this {
    this.data.permissions = ['READ'];
    return this;
  }

  fullAccess(): this {
    this.data.permissions = ['READ', 'WRITE', 'DELETE'];
    return this;
  }

  expired(): this {
    this.data.expiresAt = faker.date.past();
    return this;
  }

  revoked(): this {
    this.data.isActive = false;
    return this;
  }

  build(): any {
    return { ...this.data };
  }

  static create(options?: FactoryOptions): any {
    return new AccessControlFactory(options).build();
  }

  static createMany(count: number, options?: FactoryOptions): any[] {
    return Array.from({ length: count }, () => new AccessControlFactory(options).build());
  }
}

/**
 * Convenience function to create multiple related entities
 */
export class TestDataBuilder {
  private options: FactoryOptions;

  constructor(options: FactoryOptions = {}) {
    this.options = options;
  }

  /**
   * Create a complete patient with records and audit logs
   */
  createPatientWithRecords(recordCount: number = 3) {
    const patient = new PatientFactory(this.options).build();
    const records = Array.from({ length: recordCount }, () =>
      new RecordFactory(this.options).withPatientId(patient.id).build()
    );
    const auditLogs = records.map(record =>
      new AuditLogFactory(this.options)
        .withResourceId(record.id)
        .withResourceType('RECORD')
        .asRecordCreate()
        .build()
    );

    return { patient, records, auditLogs };
  }

  /**
   * Create a user with access to patient records
   */
  createUserWithAccess(patientId: string, recordIds: string[]) {
    const user = new UserFactory(this.options).asDoctor().build();
    const accessControls = recordIds.map(recordId =>
      new AccessControlFactory(this.options)
        .withPatientId(patientId)
        .withGrantedTo(user.id)
        .withRecordId(recordId)
        .readOnly()
        .build()
    );

    return { user, accessControls };
  }

  /**
   * Create a complete test scenario
   */
  createCompleteScenario() {
    const admin = new UserFactory(this.options).asAdmin().build();
    const doctor = new UserFactory(this.options).asDoctor().build();
    const { patient, records, auditLogs } = this.createPatientWithRecords(5);
    const { accessControls } = this.createUserWithAccess(patient.id, records.map(r => r.id));

    return {
      users: [admin, doctor],
      patient,
      records,
      auditLogs,
      accessControls,
    };
  }
}

/**
 * Export convenience functions
 */
export const createUser = (options?: FactoryOptions) => new UserFactory(options);
export const createPatient = (options?: FactoryOptions) => new PatientFactory(options);
export const createRecord = (options?: FactoryOptions) => new RecordFactory(options);
export const createAuditLog = (options?: FactoryOptions) => new AuditLogFactory(options);
export const createAccessControl = (options?: FactoryOptions) => new AccessControlFactory(options);
export const createTestData = (options?: FactoryOptions) => new TestDataBuilder(options);
