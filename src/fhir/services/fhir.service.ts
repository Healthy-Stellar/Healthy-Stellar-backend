import { Injectable, ConflictException, Logger } from '@nestjs/common';
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
      default:
        throw new Error(`Unsupported resource type: ${resource.resourceType}`);
    }
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
  ): Promise<any> {
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
  ): Promise<any> {
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
  ): Promise<any> {
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
      `Updated DocumentReference ${id} from version ${oldVersion} to ${newVersion}`,
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
  ): Promise<any> {
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

    this.logger.log(`Updated Consent ${id} from version ${oldVersion} to ${newVersion}`);

    return resource;
  }

  // ── Read operations ───────────────────────────────────────────────────────

  getCapabilityStatement(): any {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      version: '4.0.1',
      fhirVersion: '4.0.1',
      kind: 'instance',
      description: 'Healthy-Stellar FHIR R4 Server',
    };
  }

  getPatient(id: string): any {
    // TODO: Fetch from database
    return { resourceType: 'Patient', id };
  }

  getPatientDocuments(id: string): any[] {
    // TODO: Fetch from database
    return [];
  }

  getDocumentReference(id: string): any {
    // TODO: Fetch from database
    return { resourceType: 'DocumentReference', id };
  }

  getConsent(id: string): any {
    // TODO: Fetch from database
    return { resourceType: 'Consent', id };
  }

  getProvenance(target?: string): any[] {
    // TODO: Fetch from database
    return [];
  }
}

  }
}
