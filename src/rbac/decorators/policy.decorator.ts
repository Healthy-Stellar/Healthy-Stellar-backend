import { SetMetadata } from '@nestjs/common';
import { POLICY_KEY, RESOURCE_KEY, ACTION_KEY, PolicyRequirement } from '../guards/policy.guard';
import { ResourceContext, ActionContext } from '../services/policy-engine.service';

/**
 * Decorator to require specific policy evaluation for a route or controller
 * @param requirement Policy requirement configuration
 */
export const RequirePolicy = (requirement: PolicyRequirement) => {
  return SetMetadata(POLICY_KEY, requirement);
};

/**
 * Decorator to specify the resource type for policy evaluation
 * @param resourceType The resource type (e.g., 'patient', 'record', 'user')
 */
export const Resource = (resourceType: string) => {
  return SetMetadata(RESOURCE_KEY, resourceType);
};

/**
 * Decorator to specify detailed resource context for policy evaluation
 * @param resourceContext Full resource context object
 */
export const ResourceContext = (resourceContext: ResourceContext) => {
  return SetMetadata(RESOURCE_KEY, resourceContext);
};

/**
 * Decorator to specify the action for policy evaluation
 * @param action The action name (e.g., 'read', 'write', 'delete')
 */
export const Action = (action: string) => {
  return SetMetadata(ACTION_KEY, action);
};

/**
 * Decorator to specify detailed action context for policy evaluation
 * @param actionContext Full action context object
 */
export const ActionContext = (actionContext: ActionContext) => {
  return SetMetadata(ACTION_KEY, actionContext);
};

/**
 * Predefined policy decorators for common use cases
 */

// Admin-only access
export const RequireAdmin = () =>
  RequirePolicy({
    name: 'admin-access',
    category: 'administration',
  });

// Patient data access (requires specific patient permissions)
export const RequirePatientAccess = () =>
  RequirePolicy({
    category: 'patient-data',
    resource: 'patient',
  });

// Medical record access
export const RequireMedicalRecordAccess = (action: string = 'read') =>
  RequirePolicy({
    category: 'medical-records',
    resource: 'medical-record',
    action,
  });

// Billing access
export const RequireBillingAccess = () =>
  RequirePolicy({
    category: 'billing',
    resource: 'billing',
  });

// User management access
export const RequireUserManagement = () =>
  RequirePolicy({
    category: 'user-management',
    resource: 'user',
  });

// Organization-level access
export const RequireOrganizationAccess = () =>
  RequirePolicy({
    category: 'organization',
    resource: 'organization',
  });

/**
 * Resource-specific decorators
 */

// Patient resources
export const PatientResource = () => Resource('patient');
export const PatientRead = () => Action('read');
export const PatientWrite = () => Action('write');
export const PatientDelete = () => Action('delete');

// Medical record resources
export const MedicalRecordResource = () => Resource('medical-record');
export const RecordRead = () => Action('read');
export const RecordWrite = () => Action('write');
export const RecordDelete = () => Action('delete');

// User resources
export const UserResource = () => Resource('user');
export const UserRead = () => Action('read');
export const UserWrite = () => Action('write');
export const UserDelete = () => Action('delete');

/**
 * Combined decorators for convenience
 */
export const AdminOnly = () => RequireAdmin();
export const PatientDataRead = () =>
  RequirePolicy({
    category: 'patient-data',
    resource: 'patient',
    action: 'read',
  });

export const PatientDataWrite = () =>
  RequirePolicy({
    category: 'patient-data',
    resource: 'patient',
    action: 'write',
  });

export const MedicalRecordRead = () =>
  RequirePolicy({
    category: 'medical-records',
    resource: 'medical-record',
    action: 'read',
  });

export const MedicalRecordWrite = () =>
  RequirePolicy({
    category: 'medical-records',
    resource: 'medical-record',
    action: 'write',
  });
