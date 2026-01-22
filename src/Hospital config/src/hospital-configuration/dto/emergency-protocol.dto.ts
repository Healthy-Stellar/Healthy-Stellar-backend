export class EmergencyProtocolDto {
  id: string;
  protocolName: string;
  code: string;
  emergencyType:
    | "code-blue"
    | "code-red"
    | "code-yellow"
    | "code-black"
    | "mass-casualty"
    | "natural-disaster";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  activationCriteria: string[];
  responseTeam: ResponseTeamDto[];
  responseSteps: EmergencyStepDto[];
  requiredEquipment: string[];
  evacuationPlan?: EvacuationPlanDto;
  communicationProtocol: CommunicationProtocolDto;
  trainingRequired: boolean;
  lastDrillDate: Date;
  nextDrillDate: Date;
}

export class ResponseTeamDto {
  role: string;
  requiredCount: number;
  responsibilities: string[];
  contactMethod: string;
}

export class EmergencyStepDto {
  stepNumber: number;
  action: string;
  responsibleRole: string;
  timeFrame: string;
  critical: boolean;
}

export class EvacuationPlanDto {
  primaryRoute: string[];
  alternativeRoutes: string[][];
  assemblyPoint: string;
  specialConsiderations: string[];
}

export class CommunicationProtocolDto {
  internalChannels: string[];
  externalAgencies: string[];
  escalationChain: string[];
  broadcastMethod: string;
}
