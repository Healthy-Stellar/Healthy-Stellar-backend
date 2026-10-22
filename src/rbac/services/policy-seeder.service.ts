import { Injectable } from '@nestjs/common';
import { PolicyService, CreatePolicyDto } from '../services/policy.service';
import { PolicyEffect } from '../entities/access-policy.entity';

/**
 * Seeds default policies that replicate existing authorization logic
 * This helps with migration from simple role checks to policy-based authorization
 */
@Injectable()
export class PolicySeeder {
  constructor(private readonly policyService: PolicyService) {}

  async seedDefaultPolicies(): Promise<void> {
    const defaultPolicies: CreatePolicyDto[] = [
      // Admin access policies
      {
        name: 'admin-full-access',
        description: 'Full access for admin users',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: ['admin', 'super_admin'] }],
        priority: 100,
        category: 'administration',
      },

      // Physician access policies
      {
        name: 'physician-patient-access',
        description: 'Physicians can access patient data',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'physician' }],
        resources: [{ type: 'resource', value: 'patient' }],
        actions: [{ type: 'action', value: ['read', 'write'] }],
        priority: 80,
        category: 'patient-data',
      },

      {
        name: 'physician-medical-records',
        description: 'Physicians can access medical records',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'physician' }],
        resources: [{ type: 'resource', value: 'medical-record' }],
        actions: [{ type: 'action', value: ['read', 'write'] }],
        priority: 80,
        category: 'medical-records',
      },

      // Nurse access policies
      {
        name: 'nurse-patient-read',
        description: 'Nurses can read patient data',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'nurse' }],
        resources: [{ type: 'resource', value: 'patient' }],
        actions: [{ type: 'action', value: 'read' }],
        priority: 70,
        category: 'patient-data',
      },

      {
        name: 'nurse-patient-write',
        description: 'Nurses can write patient data',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'nurse' }],
        resources: [{ type: 'resource', value: 'patient' }],
        actions: [{ type: 'action', value: 'write' }],
        priority: 70,
        category: 'patient-data',
      },

      // Patient access policies (limited to own data)
      {
        name: 'patient-own-data',
        description: 'Patients can access their own data',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'patient' }],
        resources: [{ type: 'resource', value: 'patient' }],
        actions: [{ type: 'action', value: 'read' }],
        conditions: [
          {
            type: 'attribute',
            operator: 'equals',
            field: 'resource.attributes.ownerId',
            value: '${user.id}',
          },
        ],
        priority: 60,
        category: 'patient-data',
      },

      // Billing staff policies
      {
        name: 'billing-staff-access',
        description: 'Billing staff can access billing data',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'billing_staff' }],
        resources: [{ type: 'resource', value: 'billing' }],
        actions: [{ type: 'action', value: ['read', 'write'] }],
        priority: 50,
        category: 'billing',
      },

      // Medical records staff policies
      {
        name: 'medical-records-staff-access',
        description: 'Medical records staff can manage records',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'medical_records' }],
        resources: [{ type: 'resource', value: 'medical-record' }],
        actions: [{ type: 'action', value: ['read', 'write'] }],
        priority: 50,
        category: 'medical-records',
      },

      // Default deny policy (lowest priority)
      {
        name: 'default-deny',
        description: 'Default deny for all unmatched requests',
        effect: PolicyEffect.DENY,
        priority: 0,
        category: 'default',
      },
    ];

    // Create policies in bulk
    await this.policyService.createBulk(defaultPolicies);
  }

  async seedMedicalPolicies(): Promise<void> {
    const medicalPolicies: CreatePolicyDto[] = [
      // Medical RBAC policies that replicate the existing MedicalPermissionsService
      {
        name: 'medical-admin-full-access',
        description: 'Medical admins have full access',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'admin' }],
        resources: [{ type: 'pattern', value: 'medical-*' }],
        actions: [{ type: 'action', value: ['read', 'write', 'delete'] }],
        priority: 90,
        category: 'medical-rbac',
      },

      {
        name: 'medical-doctor-access',
        description: 'Doctors have comprehensive medical access',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'doctor' }],
        resources: [
          { type: 'resource', value: ['patient', 'medical-record', 'lab-result', 'prescription'] },
        ],
        actions: [{ type: 'action', value: ['read', 'write'] }],
        priority: 85,
        category: 'medical-rbac',
      },

      {
        name: 'medical-nurse-access',
        description: 'Nurses have patient care access',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'nurse' }],
        resources: [{ type: 'resource', value: ['patient', 'medical-record', 'lab-result'] }],
        actions: [{ type: 'action', value: ['read', 'write'] }],
        priority: 75,
        category: 'medical-rbac',
      },

      {
        name: 'medical-pharmacist-access',
        description: 'Pharmacists can manage prescriptions',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'pharmacist' }],
        resources: [{ type: 'resource', value: 'prescription' }],
        actions: [{ type: 'action', value: ['read', 'write', 'dispense'] }],
        priority: 70,
        category: 'medical-rbac',
      },

      {
        name: 'medical-lab-tech-access',
        description: 'Lab technicians can manage lab results',
        effect: PolicyEffect.ALLOW,
        subjects: [{ type: 'role', value: 'lab_technician' }],
        resources: [{ type: 'resource', value: 'lab-result' }],
        actions: [{ type: 'action', value: ['read', 'write'] }],
        priority: 70,
        category: 'medical-rbac',
      },
    ];

    await this.policyService.createBulk(medicalPolicies);
  }
}
