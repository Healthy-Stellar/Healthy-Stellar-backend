export class HospitalPolicyDto {
  id: string;
  title: string;
  policyNumber: string;
  category: "clinical" | "administrative" | "safety" | "compliance" | "hr";
  description: string;
  effectiveDate: Date;
  reviewDate: Date;
  approvedBy: string;
  departmentsApplicable: string[];
  content: string;
  attachments: string[];
  status: "active" | "draft" | "archived";
}

export class MedicalProcedureDto {
  id: string;
  name: string;
  procedureCode: string;
  category: string;
  description: string;
  steps: ProcedureStepDto[];
  requiredEquipment: string[];
  requiredPersonnel: string[];
  estimatedDuration: number;
  contraindications: string[];
  complications: string[];
  departmentId: string;
}

export class ProcedureStepDto {
  stepNumber: number;
  description: string;
  duration: number;
  criticalStep: boolean;
}
