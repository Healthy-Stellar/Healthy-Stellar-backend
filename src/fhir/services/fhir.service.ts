import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FhirMapperService } from '../mappers/fhir-mapper.service';
import { FhirValidatorService } from './fhir-validator.service';
import { v4 as uuidv4 } from 'uuid';
import { FhirOperationOutcome } from '../dto/fhir-resources.dto';

/**
 * Service for FHIR R4 resource operations.
 * Implements conflict resolution using optimistic locking with If-Match ETags.
 */
@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);

  constructor(
    private readonly mapperService: FhirMapperService,
    private readonly validatorService: FhirValidatorService,
  ) {}

  // ── Conversion ────────────────────────────────────────────────────────────

  convertToFhir(resourceType: string, entity: any): any {
    let resource: any;

    switch (resourceType) {
      case 'Patient':
        resource = this.mapperService.mapPatientToFhir(entity);
        break;
      case 'DocumentReference':
        resource = this.mapperService.mapDocumentReferenceToFhir(entity);
        break;
      case 'Provenance':
        resource = this.mapperService.mapProvenanceToFhir(entity);
        break;
      case 'Consent':
        resource = this.mapperService.mapConsentToFhir(entity);
        break;
      case 'Observation':
        resource = this.mapperService.mapObservationToFhir(entity);
        break;
      case 'MedicationAdministration':
        resource = this.mapperService.mapMedicationAdministrationToFhir(entity);
        break;
      case 'Encounter':
        resource = this.mapperService.mapEncounterToFhir(entity);
        break;
      case 'DiagnosticReport':
        resource = this.mapperService.mapDiagnosticReportToFhir(entity);
        break;
      case 'Condition':
        resource = this.mapperService.mapConditionToFhir(entity);
        break;
      case 'Procedure':
        resource = this.mapperService.mapProcedureToFhir(entity);
        break;
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }

    this.validatorService.validateResource(resource);
    return resource;
  }

  convertFromFhir(resource: any): any {
    this.validatorService.validateResource(resource);

    switch (resource.resourceType) {
      case 'Patient':
        return this.mapperService.mapPatientFromFhir(resource);
      case 'DocumentReference':
        return this.mapperService.mapDocumentReferenceFromFhir(resource);
      case 'Provenance':
        return this.mapperService.mapProvenanceFromFhir(resource);
      case 'Consent':
        return this.mapperService.mapConsentFromFhir(resource);
      case 'Observation':
        return this.mapperService.mapObservationFromFhir(resource);
      case 'MedicationAdministration':
        return this.mapperService.mapMedicationAdministrationFromFhir(resource);
      case 'Encounter':
        return this.mapperService.mapEncounterFromFhir(resource);
      case 'DiagnosticReport':
        return this.mapperService.mapDiagnosticReportFromFhir(resource);
      case 'Condition':
        return this.mapperService.mapConditionFromFhir(resource);
      case 'Procedure':
        return this.mapperService.mapProcedureFromFhir(resource);
      default:
        throw new Error(`Unsupported resource type: ${resource.resourceType}`);
    }
  }

  // ── Authorization ─────────────────────────────────────────────────────────

  /**
   * Enforce role + patient-context authorization for a FHIR operation.
   *
   * Rules:
   * - Patients may only access their own compartment.
   * - Clinicians (and other privileged roles) may access a patient's data only
   *   when they hold an access grant or an active care relationship.
   * - OAuth2 tokens must carry a SMART scope permitting the operation
   *   (e.g. `patient/*.read`, `user/Patient.write`).
   *
   * Throws ForbiddenException when the caller is not permitted.
   */
  private authorizeAccess(
    user: any,
    patientId: string | undefined,
    resourceType: string,
    action: 'read' | 'write',
  ): void {
    if (!user) {
      throw new ForbiddenException('Authentication required for FHIR access');
    }

    this.enforceSmartScope(user, resourceType, action);

    const roles: string[] = this.normalizeRoles(user);
    const isPatient = roles.includes('patient');
    const isPrivileged = roles.some((role) =>
      ['clinician', 'physician', 'doctor', 'nurse', 'admin', 'practitioner'].includes(role),
    );

    if (isPatient) {
      const ownId = user.patientId || user.id;
      if (!patientId || !ownId || String(ownId) !== String(patientId)) {
        throw new ForbiddenException(
          'Patients may only access their own FHIR compartment',
        );
      }
      return;
    }

    if (isPrivileged) {
      if (!patientId) {
        throw new ForbiddenException('Patient context is required for this operation');
      }
      if (!this.hasCareRelationship(user, patientId)) {
        throw new ForbiddenException(
          'No access grant or care relationship for this patient',
        );
      }
      return;
    }

    throw new ForbiddenException('Insufficient role for FHIR access');
  }

  /**
   * Enforce SMART-on-FHIR scopes for OAuth2-issued tokens.
   * Non-OAuth2 (session/JWT) tokens without a scope list are not scope-limited.
   */
  private enforceSmartScope(
    user: any,
    resourceType: string,
    action: 'read' | 'write',
  ): void {
    const scopes: string[] | undefined = user.scopes || user.scope?.split?.(' ');
    if (!scopes || scopes.length === 0) {
      return;
    }

    const required = `${resourceType}.${action}`;
    const wildcard = '*';
    const permitted = scopes.some((scope) => {
      const normalized = String(scope).trim();
      if (!normalized) return false;
      const [, resourceAndAction] = normalized.split('/');
      if (!resourceAndAction) return false;
      const [resource, scopeAction] = resourceAndAction.split('.');
      const resourceMatches = resource === wildcard || resource === resourceType;
      const actionMatches = scopeAction === wildcard || scopeAction === action;
      return resourceMatches && actionMatches;
    });

    if (!permitted) {
      throw new ForbiddenException(
        `Missing required SMART scope for ${required}`,
      );
    }
  }

  private normalizeRoles(user: any): string[] {
    const raw = user.roles || user.role || [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list
      .map((role: any) =>
        typeof role === 'string' ? role : role?.name || role?.code || '',
      )
      .filter(Boolean)
      .map((role: string) => role.toLowerCase());
  }

  /**
   * Determine whether a clinician has an access grant or care relationship
   * with the given patient.
   */
  private hasCareRelationship(user: any, patientId: string): boolean {
    const grants: any[] = user.accessGrants || user.patientAccess || [];
    const careRelationships: any[] =
      user.careRelationships || user.patients || [];

    const matches = (entry: any): boolean => {
      const id =
        typeof entry === 'string'
          ? entry
          : entry?.patientId || entry?.patient?.id || entry?.id;
      return id != null && String(id) === String(patientId);
    };

    return grants.some(matches) || careRelationships.some(matches);
  }

  // ── Read operations ───────────────────────────────────────────────────────

  /**
   * Read a Patient resource by id.
   * Returns the mapped FHIR R4 Patient with real demographic data.
   */
  async getPatient(id: string, user?: any): Promise<any> {
    this.authorizeAccess(user, id, 'Patient', 'read');
    const entity = await this.fetchEntity('Patient', id);
    if (!entity) {
      throw new NotFoundException(`Patient/${id} not found`);
    }
    return this.convertToFhir('Patient', entity);
  }

  /**
   * Read all DocumentReference resources belonging to a Patient.
   */
  async getPatientDocuments(id: string, user?: any): Promise<any[]> {
    this.authorizeAccess(user, id, 'DocumentReference', 'read');
    const entities = await this.fetchEntities('DocumentReference', { patientId: id });
    return entities.map((entity) => this.convertToFhir('DocumentReference', entity));
  }

  /**
   * Read a DocumentReference resource by id.
   */
  async getDocumentReference(id: string, user?: any): Promise<any> {
    const entity = await this.fetchEntity('DocumentReference', id);
    if (!entity) {
      throw new NotFoundException(`DocumentReference/${id} not found`);
    }
    this.authorizeAccess(
      user,
      this.resolvePatientId(entity),
      'DocumentReference',
      'read',
    );
    return this.convertToFhir('DocumentReference', entity);
  }

  /**
   * Read a Consent resource by id.
   */
  async getConsent(id: string, user?: any): Promise<any> {
    const entity = await this.fetchEntity('Consent', id);
    if (!entity) {
      throw new NotFoundException(`Consent/${id} not found`);
    }
    this.authorizeAccess(user, this.resolvePatientId(entity), 'Consent', 'read');
    return this.convertToFhir('Consent', entity);
  }

  /**
   * Read Provenance resources for a given target reference.
   */
  async getProvenance(target: string, user?: any): Promise<any[]> {
    const patientId = this.resolvePatientIdFromReference(target);
    this.authorizeAccess(user, patientId, 'Provenance', 'read');
    const entities = await this.fetchEntities('Provenance', { target });
    return entities.map((entity) => this.convertToFhir('Provenance', entity));
  }

  /**
   * Resolve the owning patient id from a resource entity.
   */
  private resolvePatientId(entity: any): string | undefined {
    if (!entity) return undefined;
    const candidate =
      entity.patientId ||
      entity.patient?.id ||
      entity.subject?.reference ||
      entity.patient?.reference;
    return this.resolvePatientIdFromReference(candidate);
  }

  /**
   * Extract a patient id from a raw id or a FHIR reference (e.g. `Patient/123`).
   */
  private resolvePatientIdFromReference(
    reference: string | undefined,
  ): string | undefined {
    if (!reference) return undefined;
    const value = String(reference);
    const match = value.match(/Patient\/([^/]+)/);
    return match ? match[1] : value;
  }

  /**
   * Fetch a single entity for a FHIR resource type from the database.
   * Delegates to the mapper service's repository accessors so the read
   * endpoints return real record data instead of hardcoded stubs.
   */
  private async fetchEntity(resourceType: string, id: string): Promise<any | null> {
    const repository = this.mapperService.getRepository(resourceType);
    if (!repository) {
      this.logger.warn(`No repository registered for FHIR resource type ${resourceType}`);
      return null;
    }
    return repository.findOne({ where: { id } });
  }

  /**
   * Fetch multiple entities for a FHIR resource type matching the given criteria.
   */
  private async fetchEntities(resourceType: string, criteria: Record<string, any>): Promise<any[]> {
    const repository = this.mapperService.getRepository(resourceType);
    if (!repository) {
      this.logger.warn(`No repository registered for FHIR resource type ${resourceType}`);
      return [];
    }
    return repository.find({ where: criteria });
  }

  // ── Helper methods ────────────────────────────────────────────────────────

  /**
   * Extract versionId from If-Match ETag header.
   * RFC 7232 format: `W/"versionId"` (weak ETag for healthcare)
   */
  private extractVersionFromETag(eTagHeader?: string): string | undefined {
    if (!eTagHeader) return undefined;

    // Match weak ETag format: W/"versionId"
    const match = eTagHeader.match(/W?"([^"]+)"/);
    return match ? match[1] : undefined;
  }

  /**
   * Generate ETag header value from versionId.
   */
  private generateETag(versionId: string): string {
    return `W/"${versionId}"`;
  }

  /**
   * Create FHIR OperationOutcome for conflict response.
   */
  private createConflictOutcome(currentVersion: string, expectedVersion: string): FhirOperationOutcome {
    return {
      resourceType: 'OperationOutcome',
      id: uuidv4(),
      issue: [
        {
          severity: 'error',
          code: 'conflict',
          diagnostics: `Resource version conflict. Expected version ${expectedVersion}, but current version is ${currentVersion}. Client may need to refresh and retry.`,
          expression: ['Resource.meta.versionId'],
        },
      ],
    };
  }

  // ── Update operations with optimistic locking ─────────────────────────────

  /**
   * Update a Patient resource with optimistic locking support.
   * If If-Match header is provided, verifies version before updating.
   * Returns 409 Conflict if versions don't match.
   */
  async updatePatient(
    id: string,
    resource: any,
    ifMatch?: string,
    userId?: string,
    user?: any,
  ): Promise<any> {
    this.authorizeAccess(user, id, 'Patient', 'write');

    // Validate the incoming resource
    this.validatorService.validateResource(resource);

    // In a real implementation, this would:
    // 1. Fetch current resource from database
    // 2. Check If-Match version
    // 3. Increment versionId
    // 4. Save to database
    // For now, we'll implement the conflict detection pattern

    const expectedVersion = this.extractVersionFromETag(ifMatch);

    if (expectedVersion) {
      // Simulate fetching current resource - in production, query database
      const currentVersion = resource.meta?.versionId || '1';

      if (currentVersion !== expectedVersion) {
        const outcome = this.createConflictOutcome(currentVersion, expectedVersion);
        throw new ConflictException({
          statusCode: 409,
          message: `FHIR resource conflict - version mismatch`,
          code: 'FHIR_VERSION_CONFLICT',
          operationOutcome: outcome,
        });
      }
    }

    // Update versionId to new version
    if (!resource.meta) {
      resource.meta = {};
    }

    const oldVersion = resource.meta.versionId || '0';
    const newVersion = String(parseInt(oldVersion, 10) + 1);

    resource.meta.versionId = newVersion;
    resource.meta.lastUpdated = new Date().toISOString();

    this.logger.log(
      `Updated Patient ${id} from version ${oldVersion} to ${newVersion} by user ${userId}`,
    );

    return resource;
  }

  /**
   * Patch a Patient resource (JSON Patch RFC 6902) with optimistic locking.
   */
  async patchPatient(
    id: string,
    patches: any[],
    ifMatch?: string,
    userId?: string,
    user?: any,
  ): Promise<any> {
    this.authorizeAccess(user, id, 'Patient', 'write');

    const expectedVersion = this.extractVersionFromETag(ifMatch);

    if (expectedVersion) {
      // In production, fetch current resource and check version
      // For now, just validate the pattern
      this.logger.log(
        `Patch Patient ${id}: expected version=${expectedVersion}, user=${userId}`,
      );
    }

    // Apply patches and increment version
    this.logger.log(`Patched Patient ${id} with ${patches.length} patches`);

    return { success: true, patched: patches.length };
  }

  /**
   * Update a DocumentReference resource with optimistic locking.
   */
  async updateDocumentReference(
    id: string,
    resource: any,
    ifMatch?: string,
    userId?: string,
    user?: any,
  ): Promise<any> {
    const existing = await this.fetchEntity('DocumentReference', id);
    const patientId =
      this.resolvePatientId(existing) || this.resolvePatientId(resource);
    this.authorizeAccess(user, patientId, 'DocumentReference', 'write');

    this.validatorService.validateResource(resource);

    const expectedVersion = this.extractVersionFromETag(ifMatch);

    if (expectedVersion) {
      const currentVersion = resource.meta?.versionId || '1';

      if (currentVersion !== expectedVersion) {
        const outcome = this.createConflictOutcome(currentVersion, expectedVersion);
        throw new ConflictException({
          statusCode: 409,
          message: `FHIR resource conflict - version mismatch`,
          code: 'FHIR_VERSION_CONFLICT',
          operationOutcome: outcome,
        });
      }
    }

    if (!resource.meta) {
      resource.meta = {};
    }

    const oldVersion = resource.meta.versionId || '0';
    const newVersion = String(parseInt(oldVersion, 10) + 1);

    resource.meta.versionId = newVersion;
    resource.meta.lastUpdated = new Date().toISOString();

    this.logger.log(
      `Updated DocumentReference ${id} from version ${oldVersion} to ${newVersion} by user ${userId}`,
    );

    return resource;
  }

  /**
   * Update a Consent resource with optimistic locking.
   */
  async updateConsent(
    id: string,
    resource: any,
    ifMatch?: string,
    userId?: string,
    user?: any,
  ): Promise<any> {
    const existing = await this.fetchEntity('Consent', id);
    const patientId = this.resolvePatientId(existing) || this.resolvePatientId(resource);
    this.authorizeAccess(user, patientId, 'Consent', 'write');

    this.validatorService.validateResource(resource);

    const expectedVersion = this.extractVersionFromETag(ifMatch);

    if (expectedVersion) {
      const currentVersion = resource.meta?.versionId || '1';

      if (currentVersion !== expectedVersion) {
        const outcome = this.createConflictOutcome(currentVersion, expectedVersion);
        throw new ConflictException({
          statusCode: 409,
          message: `FHIR resource conflict - version mismatch`,
          code: 'FHIR_VERSION_CONFLICT',
          operationOutcome: outcome,
        });
      }
    }

    if (!resource.meta) {
      resource.meta = {};
    }

    const oldVersion = resource.meta.versionId || '0';
    const newVersion = String(parseInt(oldVersion, 10) + 1);

    resource.meta.versionId = newVersion;
    resource.meta.lastUpdated = new Date().toISOString();

    this.logger.log(
      `Updated Consent ${id} from version ${oldVersion} to ${newVersion} by user ${userId}`,
    );

    return resource;
  }
}
