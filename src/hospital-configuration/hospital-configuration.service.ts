import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HospitalConfig,
  Department,
  Equipment,
  Resource,
  Policy,
  Procedure,
  AlertConfig,
  NotificationSettings,
  InsuranceProvider,
  BillingConfig,
  EmergencyProtocol,
} from './entities/hospital-configuration.entity';

@Injectable()
export class HospitalConfigurationService {
  private readonly logger = new Logger(HospitalConfigurationService.name);

  constructor(
    @InjectRepository(HospitalConfig)
    private readonly configRepository: Repository<HospitalConfig>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(Resource)
    private readonly resourceRepository: Repository<Resource>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Procedure)
    private readonly procedureRepository: Repository<Procedure>,
    @InjectRepository(AlertConfig)
    private readonly alertConfigRepository: Repository<AlertConfig>,
    @InjectRepository(NotificationSettings)
    private readonly notificationSettingsRepository: Repository<NotificationSettings>,
    @InjectRepository(InsuranceProvider)
    private readonly insuranceProviderRepository: Repository<InsuranceProvider>,
    @InjectRepository(BillingConfig)
    private readonly billingConfigRepository: Repository<BillingConfig>,
    @InjectRepository(EmergencyProtocol)
    private readonly emergencyProtocolRepository: Repository<EmergencyProtocol>,
  ) {}

  private async getOrCreateConfig(): Promise<HospitalConfig> {
    let config = await this.configRepository.findOne({ where: {} });
    if (!config) {
      config = this.configRepository.create({ timezone: 'UTC' });
      config = await this.configRepository.save(config);
    }
    return config;
  }

  async getHospitalConfig(): Promise<HospitalConfig> {
    return this.getOrCreateConfig();
  }

  async updateHospitalConfig(updates: Partial<HospitalConfig>): Promise<HospitalConfig> {
    const config = await this.getOrCreateConfig();
    Object.assign(config, updates);
    return this.configRepository.save(config);
  }

  async getTimezone(): Promise<string> {
    const config = await this.getOrCreateConfig();
    return config.timezone;
  }

  async setTimezone(timezone: string): Promise<HospitalConfig> {
    return this.updateHospitalConfig({ timezone });
  }

  async createDepartment(data: Partial<Department>): Promise<Department> {
    const department = this.departmentRepository.create(data);
    return this.departmentRepository.save(department);
  }

  async getDepartments(): Promise<Department[]> {
    return this.departmentRepository.find();
  }

  async getDepartment(id: string): Promise<Department> {
    const department = await this.departmentRepository.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department> {
    const department = await this.getDepartment(id);
    Object.assign(department, updates);
    return this.departmentRepository.save(department);
  }

  async deleteDepartment(id: string): Promise<void> {
    const department = await this.getDepartment(id);
    await this.departmentRepository.remove(department);
  }

  async addEquipment(data: Partial<Equipment>): Promise<Equipment> {
    const equipment = this.equipmentRepository.create(data);
    return this.equipmentRepository.save(equipment);
  }

  async getEquipment(): Promise<Equipment[]> {
    return this.equipmentRepository.find();
  }

  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({ where: { id } });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }
    Object.assign(equipment, updates);
    return this.equipmentRepository.save(equipment);
  }

  async removeEquipment(id: string): Promise<void> {
    const equipment = await this.equipmentRepository.findOne({ where: { id } });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }
    await this.equipmentRepository.remove(equipment);
  }

  async createResource(data: Partial<Resource>): Promise<Resource> {
    const resource = this.resourceRepository.create(data);
    return this.resourceRepository.save(resource);
  }

  async getResources(): Promise<Resource[]> {
    return this.resourceRepository.find();
  }

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource> {
    const resource = await this.resourceRepository.findOne({ where: { id } });
    if (!resource) {
      throw new NotFoundException(`Resource ${id} not found`);
    }
    Object.assign(resource, updates);
    return this.resourceRepository.save(resource);
  }

  async createPolicy(data: Partial<Policy>): Promise<Policy> {
    const policy = this.policyRepository.create(data);
    return this.policyRepository.save(policy);
  }

  async getPolicies(): Promise<Policy[]> {
    return this.policyRepository.find();
  }

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    const policy = await this.policyRepository.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Policy ${id} not found`);
    }
    Object.assign(policy, updates);
    return this.policyRepository.save(policy);
  }

  async createProcedure(data: Partial<Procedure>): Promise<Procedure> {
    const procedure = this.procedureRepository.create(data);
    return this.procedureRepository.save(procedure);
  }

  async getProcedures(): Promise<Procedure[]> {
    return this.procedureRepository.find();
  }

  async updateProcedure(id: string, updates: Partial<Procedure>): Promise<Procedure> {
    const procedure = await this.procedureRepository.findOne({ where: { id } });
    if (!procedure) {
      throw new NotFoundException(`Procedure ${id} not found`);
    }
    Object.assign(procedure, updates);
    return this.procedureRepository.save(procedure);
  }

  async setAlertConfig(data: Partial<AlertConfig>): Promise<AlertConfig> {
    let alertConfig = await this.alertConfigRepository.findOne({ where: {} });
    if (!alertConfig) {
      alertConfig = this.alertConfigRepository.create(data);
    } else {
      Object.assign(alertConfig, data);
    }
    return this.alertConfigRepository.save(alertConfig);
  }

  async getAlertConfig(): Promise<AlertConfig | null> {
    return this.alertConfigRepository.findOne({ where: {} });
  }

  async setNotificationSettings(data: Partial<NotificationSettings>): Promise<NotificationSettings> {
    let settings = await this.notificationSettingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.notificationSettingsRepository.create(data);
    } else {
      Object.assign(settings, data);
    }
    return this.notificationSettingsRepository.save(settings);
  }

  async getNotificationSettings(): Promise<NotificationSettings | null> {
    return this.notificationSettingsRepository.findOne({ where: {} });
  }

  async createInsuranceProvider(data: Partial<InsuranceProvider>): Promise<InsuranceProvider> {
    const provider = this.insuranceProviderRepository.create(data);
    return this.insuranceProviderRepository.save(provider);
  }

  async getInsuranceProviders(): Promise<InsuranceProvider[]> {
    return this.insuranceProviderRepository.find();
  }

  async updateInsuranceProvider(id: string, updates: Partial<InsuranceProvider>): Promise<InsuranceProvider> {
    const provider = await this.insuranceProviderRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`Insurance provider ${id} not found`);
    }
    Object.assign(provider, updates);
    return this.insuranceProviderRepository.save(provider);
  }

  async setBillingConfig(data: Partial<BillingConfig>): Promise<BillingConfig> {
    let billingConfig = await this.billingConfigRepository.findOne({ where: {} });
    if (!billingConfig) {
      billingConfig = this.billingConfigRepository.create(data);
    } else {
      Object.assign(billingConfig, data);
    }
    return this.billingConfigRepository.save(billingConfig);
  }

  async getBillingConfig(): Promise<BillingConfig | null> {
    return this.billingConfigRepository.findOne({ where: {} });
  }

  async createEmergencyProtocol(data: Partial<EmergencyProtocol>): Promise<EmergencyProtocol> {
    const protocol = this.emergencyProtocolRepository.create(data);
    return this.emergencyProtocolRepository.save(protocol);
  }

  async getEmergencyProtocols(): Promise<EmergencyProtocol[]> {
    return this.emergencyProtocolRepository.find();
  }

  async updateEmergencyProtocol(id: string, updates: Partial<EmergencyProtocol>): Promise<EmergencyProtocol> {
    const protocol = await this.emergencyProtocolRepository.findOne({ where: { id } });
    if (!protocol) {
      throw new NotFoundException(`Emergency protocol ${id} not found`);
    }
    Object.assign(protocol, updates);
    return this.emergencyProtocolRepository.save(protocol);
  }
}
