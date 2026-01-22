import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";

@Controller("hospital-configuration")
export class HospitalConfigurationController {
  constructor(private readonly configService: HospitalConfigurationService) {}

  // Department Endpoints
  @Post("departments")
  createDepartment(@Body() dept: DepartmentDto) {
    return this.configService.createDepartment(dept);
  }

  @Get("departments")
  getAllDepartments() {
    return this.configService.getAllDepartments();
  }

  @Get("departments/:id")
  getDepartment(@Param("id") id: string) {
    return this.configService.getDepartment(id);
  }

  @Put("departments/:id")
  updateDepartment(
    @Param("id") id: string,
    @Body() updates: Partial<DepartmentDto>,
  ) {
    return this.configService.updateDepartment(id, updates);
  }

  @Delete("departments/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDepartment(@Param("id") id: string) {
    this.configService.deleteDepartment(id);
  }

  // Equipment Endpoints
  @Post("equipment")
  addEquipment(@Body() equipment: MedicalEquipmentDto) {
    return this.configService.addEquipment(equipment);
  }

  @Get("equipment/:id")
  getEquipment(@Param("id") id: string) {
    return this.configService.getEquipment(id);
  }

  @Get("departments/:departmentId/equipment")
  getEquipmentByDepartment(@Param("departmentId") departmentId: string) {
    return this.configService.getEquipmentByDepartment(departmentId);
  }

  @Put("equipment/:id/status")
  updateEquipmentStatus(
    @Param("id") id: string,
    @Body("status") status: MedicalEquipmentDto["status"],
  ) {
    return this.configService.updateEquipmentStatus(id, status);
  }

  // Resource Endpoints
  @Post("resources")
  addResource(@Body() resource: ResourceDto) {
    return this.configService.addResource(resource);
  }

  @Get("departments/:departmentId/resources")
  getResourceAvailability(@Param("departmentId") departmentId: string) {
    return this.configService.getResourceAvailability(departmentId);
  }

  @Put("resources/:id/count")
  updateResourceCount(
    @Param("id") id: string,
    @Body("availableCount") count: number,
  ) {
    return this.configService.updateResourceCount(id, count);
  }

  // Policy Endpoints
  @Post("policies")
  createPolicy(@Body() policy: HospitalPolicyDto) {
    return this.configService.createPolicy(policy);
  }

  @Get("policies/:id")
  getPolicy(@Param("id") id: string) {
    return this.configService.getPolicy(id);
  }

  @Get("policies/category/:category")
  getPoliciesByCategory(
    @Param("category") category: HospitalPolicyDto["category"],
  ) {
    return this.configService.getPoliciesByCategory(category);
  }

  // Procedure Endpoints
  @Post("procedures")
  createProcedure(@Body() procedure: MedicalProcedureDto) {
    return this.configService.createProcedure(procedure);
  }

  @Get("procedures/:id")
  getProcedure(@Param("id") id: string) {
    return this.configService.getProcedure(id);
  }

  @Get("departments/:departmentId/procedures")
  getProceduresByDepartment(@Param("departmentId") departmentId: string) {
    return this.configService.getProceduresByDepartment(departmentId);
  }

  // Alert Configuration Endpoints
  @Post("alerts")
  createAlertConfig(@Body() config: MedicalAlertConfigDto) {
    return this.configService.createAlertConfig(config);
  }

  @Get("alerts/:id")
  getAlertConfig(@Param("id") id: string) {
    return this.configService.getAlertConfig(id);
  }

  @Get("alerts/active/list")
  getActiveAlerts() {
    return this.configService.getActiveAlerts();
  }

  // Notification Settings Endpoints
  @Post("notification-settings")
  setNotificationSettings(@Body() settings: NotificationSettingsDto) {
    return this.configService.setNotificationSettings(settings);
  }

  @Get("notification-settings/department/:departmentId")
  getNotificationSettings(@Param("departmentId") departmentId: string) {
    return this.configService.getNotificationSettings(departmentId);
  }

  // Insurance Provider Endpoints
  @Post("insurance-providers")
  addInsuranceProvider(@Body() provider: InsuranceProviderDto) {
    return this.configService.addInsuranceProvider(provider);
  }

  @Get("insurance-providers/:id")
  getInsuranceProvider(@Param("id") id: string) {
    return this.configService.getInsuranceProvider(id);
  }

  @Get("insurance-providers/active/list")
  getAllActiveInsuranceProviders() {
    return this.configService.getAllActiveInsuranceProviders();
  }

  // Billing Configuration Endpoints
  @Post("billing-config")
  setBillingConfig(@Body() config: BillingConfigDto) {
    return this.configService.setBillingConfig(config);
  }

  @Get("billing-config")
  getBillingConfig() {
    return this.configService.getBillingConfig();
  }

  // Emergency Protocol Endpoints
  @Post("emergency-protocols")
  createEmergencyProtocol(@Body() protocol: EmergencyProtocolDto) {
    return this.configService.createEmergencyProtocol(protocol);
  }

  @Get("emergency-protocols")
  getAllEmergencyProtocols() {
    return this.configService.getAllEmergencyProtocols();
  }

  @Get("emergency-protocols/:id")
  getEmergencyProtocol(@Param("id") id: string) {
    return this.configService.getEmergencyProtocol(id);
  }

  @Get("emergency-protocols/code/:code")
  getEmergencyProtocolByCode(@Param("code") code: string) {
    return this.configService.getEmergencyProtocolByCode(code);
  }
}
