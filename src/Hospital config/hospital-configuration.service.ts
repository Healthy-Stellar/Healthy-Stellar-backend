import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class HospitalConfigurationService {
  private departments: Map<string, DepartmentDto> = new Map();
  private equipment: Map<string, MedicalEquipmentDto> = new Map();
  private resources: Map<string, ResourceDto> = new Map();
  private policies: Map<string, HospitalPolicyDto> = new Map();
  private procedures: Map<string, MedicalProcedureDto> = new Map();
  private alertConfigs: Map<string, MedicalAlertConfigDto> = new Map();
  private notificationSettings: Map<string, NotificationSettingsDto> =
    new Map();
  private insuranceProviders: Map<string, InsuranceProviderDto> = new Map();
  private billingConfig: BillingConfigDto;
  private emergencyProtocols: Map<string, EmergencyProtocolDto> = new Map();

  constructor() {
    this.initializeDefaultConfigurations();
  }

  // Department Management
  createDepartment(dept: DepartmentDto): DepartmentDto {
    this.departments.set(dept.id, dept);
    return dept;
  }

  getDepartment(id: string): DepartmentDto {
    const dept = this.departments.get(id);
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  getAllDepartments(): DepartmentDto[] {
    return Array.from(this.departments.values());
  }

  updateDepartment(id: string, updates: Partial<DepartmentDto>): DepartmentDto {
    const dept = this.getDepartment(id);
    const updated = { ...dept, ...updates };
    this.departments.set(id, updated);
    return updated;
  }

  deleteDepartment(id: string): void {
    if (!this.departments.delete(id)) {
      throw new NotFoundException(`Department ${id} not found`);
    }
  }

  // Equipment Management
  addEquipment(equipment: MedicalEquipmentDto): MedicalEquipmentDto {
    this.equipment.set(equipment.id, equipment);
    return equipment;
  }

  getEquipment(id: string): MedicalEquipmentDto {
    const equip = this.equipment.get(id);
    if (!equip) throw new NotFoundException(`Equipment ${id} not found`);
    return equip;
  }

  getEquipmentByDepartment(departmentId: string): MedicalEquipmentDto[] {
    return Array.from(this.equipment.values()).filter(
      (e) => e.departmentId === departmentId,
    );
  }

  updateEquipmentStatus(
    id: string,
    status: MedicalEquipmentDto["status"],
  ): MedicalEquipmentDto {
    const equip = this.getEquipment(id);
    equip.status = status;
    this.equipment.set(id, equip);
    return equip;
  }

  // Resource Management
  addResource(resource: ResourceDto): ResourceDto {
    this.resources.set(resource.id, resource);
    return resource;
  }

  getResourceAvailability(departmentId: string): ResourceDto[] {
    return Array.from(this.resources.values()).filter(
      (r) => r.departmentId === departmentId,
    );
  }

  updateResourceCount(id: string, availableCount: number): ResourceDto {
    const resource = this.resources.get(id);
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    resource.availableCount = availableCount;
    resource.lastUpdated = new Date();
    this.resources.set(id, resource);
    return resource;
  }

  // Policy Management
  createPolicy(policy: HospitalPolicyDto): HospitalPolicyDto {
    this.policies.set(policy.id, policy);
    return policy;
  }

  getPolicy(id: string): HospitalPolicyDto {
    const policy = this.policies.get(id);
    if (!policy) throw new NotFoundException(`Policy ${id} not found`);
    return policy;
  }

  getPoliciesByCategory(
    category: HospitalPolicyDto["category"],
  ): HospitalPolicyDto[] {
    return Array.from(this.policies.values()).filter(
      (p) => p.category === category && p.status === "active",
    );
  }

  // Procedure Management
  createProcedure(procedure: MedicalProcedureDto): MedicalProcedureDto {
    this.procedures.set(procedure.id, procedure);
    return procedure;
  }

  getProcedure(id: string): MedicalProcedureDto {
    const proc = this.procedures.get(id);
    if (!proc) throw new NotFoundException(`Procedure ${id} not found`);
    return proc;
  }

  getProceduresByDepartment(departmentId: string): MedicalProcedureDto[] {
    return Array.from(this.procedures.values()).filter(
      (p) => p.departmentId === departmentId,
    );
  }

  // Alert Configuration
  createAlertConfig(config: MedicalAlertConfigDto): MedicalAlertConfigDto {
    this.alertConfigs.set(config.id, config);
    return config;
  }

  getAlertConfig(id: string): MedicalAlertConfigDto {
    const config = this.alertConfigs.get(id);
    if (!config) throw new NotFoundException(`Alert config ${id} not found`);
    return config;
  }

  getActiveAlerts(): MedicalAlertConfigDto[] {
    return Array.from(this.alertConfigs.values()).filter((a) => a.isActive);
  }

  // Notification Settings
  setNotificationSettings(
    settings: NotificationSettingsDto,
  ): NotificationSettingsDto {
    this.notificationSettings.set(settings.id, settings);
    return settings;
  }

  getNotificationSettings(departmentId: string): NotificationSettingsDto {
    const settings = Array.from(this.notificationSettings.values()).find(
      (s) => s.departmentId === departmentId,
    );
    if (!settings)
      throw new NotFoundException(
        `Settings for department ${departmentId} not found`,
      );
    return settings;
  }

  // Insurance Provider Management
  addInsuranceProvider(provider: InsuranceProviderDto): InsuranceProviderDto {
    this.insuranceProviders.set(provider.id, provider);
    return provider;
  }

  getInsuranceProvider(id: string): InsuranceProviderDto {
    const provider = this.insuranceProviders.get(id);
    if (!provider)
      throw new NotFoundException(`Insurance provider ${id} not found`);
    return provider;
  }

  getAllActiveInsuranceProviders(): InsuranceProviderDto[] {
    return Array.from(this.insuranceProviders.values()).filter(
      (p) => p.isActive,
    );
  }

  // Billing Configuration
  setBillingConfig(config: BillingConfigDto): BillingConfigDto {
    this.billingConfig = config;
    return config;
  }

  getBillingConfig(): BillingConfigDto {
    if (!this.billingConfig)
      throw new NotFoundException("Billing config not found");
    return this.billingConfig;
  }

  // Emergency Protocol Management
  createEmergencyProtocol(
    protocol: EmergencyProtocolDto,
  ): EmergencyProtocolDto {
    this.emergencyProtocols.set(protocol.id, protocol);
    return protocol;
  }

  getEmergencyProtocol(id: string): EmergencyProtocolDto {
    const protocol = this.emergencyProtocols.get(id);
    if (!protocol)
      throw new NotFoundException(`Emergency protocol ${id} not found`);
    return protocol;
  }

  getEmergencyProtocolByCode(code: string): EmergencyProtocolDto {
    const protocol = Array.from(this.emergencyProtocols.values()).find(
      (p) => p.code === code,
    );
    if (!protocol)
      throw new NotFoundException(
        `Emergency protocol with code ${code} not found`,
      );
    return protocol;
  }

  getAllEmergencyProtocols(): EmergencyProtocolDto[] {
    return Array.from(this.emergencyProtocols.values());
  }

  // Initialize default configurations
  private initializeDefaultConfigurations(): void {
    // Sample Emergency Department
    this.createDepartment({
      id: "dept-001",
      name: "Emergency Department",
      code: "ED",
      description: "24/7 Emergency medical services",
      headOfDepartment: "Dr. Sarah Johnson",
      contactNumber: "+1-555-0100",
      location: {
        building: "Main Hospital",
        floor: 1,
        wing: "East Wing",
        roomNumbers: ["E101-E120"],
      },
      operatingHours: {
        monday: { open: "00:00", close: "23:59", isOpen: true },
        tuesday: { open: "00:00", close: "23:59", isOpen: true },
        wednesday: { open: "00:00", close: "23:59", isOpen: true },
        thursday: { open: "00:00", close: "23:59", isOpen: true },
        friday: { open: "00:00", close: "23:59", isOpen: true },
        saturday: { open: "00:00", close: "23:59", isOpen: true },
        sunday: { open: "00:00", close: "23:59", isOpen: true },
        is24x7: true,
      },
      capacity: 50,
      specializations: ["Trauma", "Critical Care", "Pediatric Emergency"],
    });

    // Sample Emergency Protocol - Code Blue
    this.createEmergencyProtocol({
      id: "protocol-001",
      protocolName: "Cardiac Arrest Response",
      code: "CODE-BLUE",
      emergencyType: "code-blue",
      severity: "critical",
      description:
        "Immediate response protocol for cardiac arrest or respiratory arrest",
      activationCriteria: [
        "Patient unresponsive",
        "No pulse detected",
        "Not breathing or gasping",
      ],
      responseTeam: [
        {
          role: "Physician",
          requiredCount: 1,
          responsibilities: ["Lead resuscitation", "Make critical decisions"],
          contactMethod: "Pager",
        },
        {
          role: "Nurse",
          requiredCount: 2,
          responsibilities: ["CPR", "Medication administration"],
          contactMethod: "Overhead page",
        },
        {
          role: "Respiratory Therapist",
          requiredCount: 1,
          responsibilities: ["Airway management", "Ventilation"],
          contactMethod: "Pager",
        },
        {
          role: "Pharmacist",
          requiredCount: 1,
          responsibilities: ["Prepare medications", "Dosage verification"],
          contactMethod: "Phone",
        },
      ],
      responseSteps: [
        {
          stepNumber: 1,
          action: "Activate Code Blue alarm",
          responsibleRole: "First responder",
          timeFrame: "Immediate",
          critical: true,
        },
        {
          stepNumber: 2,
          action: "Begin CPR",
          responsibleRole: "Nurse",
          timeFrame: "Within 30 seconds",
          critical: true,
        },
        {
          stepNumber: 3,
          action: "Attach defibrillator/monitor",
          responsibleRole: "Nurse",
          timeFrame: "Within 1 minute",
          critical: true,
        },
        {
          stepNumber: 4,
          action: "Establish IV access",
          responsibleRole: "Nurse",
          timeFrame: "Within 2 minutes",
          critical: true,
        },
        {
          stepNumber: 5,
          action: "Administer medications per ACLS protocol",
          responsibleRole: "Physician",
          timeFrame: "As needed",
          critical: true,
        },
      ],
      requiredEquipment: [
        "Crash cart",
        "Defibrillator",
        "Oxygen",
        "Suction",
        "Medications",
      ],
      communicationProtocol: {
        internalChannels: ["Overhead paging", "Emergency hotline"],
        externalAgencies: ["EMS if transfer needed"],
        escalationChain: [
          "Charge Nurse",
          "Department Head",
          "Chief Medical Officer",
        ],
        broadcastMethod: "Hospital-wide overhead page",
      },
      trainingRequired: true,
      lastDrillDate: new Date("2025-12-15"),
      nextDrillDate: new Date("2026-03-15"),
    });

    // Sample Insurance Provider
    this.addInsuranceProvider({
      id: "ins-001",
      name: "HealthCare Plus Insurance",
      providerCode: "HCP",
      contactPerson: "John Smith",
      phoneNumber: "+1-555-0200",
      email: "claims@healthcareplus.com",
      address: "123 Insurance Ave, City, State 12345",
      payerType: "private",
      acceptedPlans: [
        {
          planId: "plan-001",
          planName: "Gold Plan",
          planType: "PPO",
          coveragePercentage: 80,
          deductible: 1000,
          copayAmount: 25,
          maxCoverage: 1000000,
          coveredServices: [
            "Emergency",
            "Surgery",
            "Diagnostics",
            "Hospitalization",
          ],
          excludedServices: ["Cosmetic procedures", "Experimental treatments"],
        },
      ],
      claimSubmissionMethod: "electronic",
      averageProcessingDays: 15,
      isActive: true,
    });
  }
}
