import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ProvisioningService } from "@/tenants/services/provisioning.service";
import { DatabaseService } from "@/tenants/services/database.service";
import { SorobanService } from "@/tenants/services/soroban.service";
import { EmailService } from "@/tenants/services/email.service";
import { Tenant, TenantStatus } from "@/tenants/entities/tenant.entity";
import {
  ProvisioningLog,
  ProvisioningStatus,
  ProvisioningStep,
} from "@/tenants/entities/provisioning-log.entity";
import { Repository } from "typeorm";

describe("ProvisioningService", () => {
  let service: ProvisioningService;
  let tenantRepository: Repository<Tenant>;
  let provisioningLogRepository: Repository<ProvisioningLog>;
  let databaseService: DatabaseService;
  let sorobanService: SorobanService;
  let emailService: EmailService;

  const mockTenant: Tenant = {
    id: "test-id-123",
    name: "Test Org",
    schemaName: "test_org_12345",
    status: TenantStatus.ACTIVE,
    adminEmail: "admin@test.local",
    adminFirstName: "Admin",
    adminLastName: "User",
    sorobanContractId: "contract_123",
    provisioningError: null,
    provisioningLogs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvisioningService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProvisioningLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            createTenantSchema: jest.fn(),
            dropTenantSchema: jest.fn(),
            runTenantMigrations: jest.fn(),
            seedTenantData: jest.fn(),
            createAdminUser: jest.fn(),
          },
        },
        {
          provide: SorobanService,
          useValue: {
            deployTenantContract: jest.fn(),
            verifyContractDeployment: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn(),
            sendProvisioningErrorEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProvisioningService>(ProvisioningService);
    tenantRepository = module.get<Repository<Tenant>>(
      getRepositoryToken(Tenant),
    );
    provisioningLogRepository = module.get<Repository<ProvisioningLog>>(
      getRepositoryToken(ProvisioningLog),
    );
    databaseService = module.get<DatabaseService>(DatabaseService);
    sorobanService = module.get<SorobanService>(SorobanService);
    emailService = module.get<EmailService>(EmailService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("provisionTenant", () => {
    it("should successfully provision a tenant", async () => {
      const tenantData = {
        name: "New Org",
        adminEmail: "admin@neworg.local",
        adminFirstName: "John",
        adminLastName: "Doe",
      };

      jest.spyOn(tenantRepository, "create").mockReturnValue(mockTenant);
      jest.spyOn(tenantRepository, "save").mockResolvedValue(mockTenant);
      jest
        .spyOn(databaseService, "createTenantSchema")
        .mockResolvedValue(undefined);
      jest
        .spyOn(databaseService, "runTenantMigrations")
        .mockResolvedValue(undefined);
      jest
        .spyOn(databaseService, "seedTenantData")
        .mockResolvedValue(undefined);
      jest
        .spyOn(databaseService, "createAdminUser")
        .mockResolvedValue("user-id-123");
      jest
        .spyOn(sorobanService, "deployTenantContract")
        .mockResolvedValue("contract_123");
      jest.spyOn(emailService, "sendWelcomeEmail").mockResolvedValue(undefined);

      const result = await service.provisionTenant(tenantData);

      expect(result).toBeDefined();
      expect(tenantRepository.create).toHaveBeenCalled();
      expect(tenantRepository.save).toHaveBeenCalled();
      expect(databaseService.createTenantSchema).toHaveBeenCalled();
      expect(databaseService.runTenantMigrations).toHaveBeenCalled();
      expect(sorobanService.deployTenantContract).toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).toHaveBeenCalled();
    });

    it("should handle provisioning errors and perform rollback", async () => {
      const tenantData = {
        name: "Error Org",
        adminEmail: "admin@errororg.local",
        adminFirstName: "Error",
        adminLastName: "Handler",
      };

      const testError = new Error("Schema creation failed");

      jest.spyOn(tenantRepository, "create").mockReturnValue(mockTenant);
      jest.spyOn(tenantRepository, "save").mockResolvedValue(mockTenant);
      jest
        .spyOn(databaseService, "createTenantSchema")
        .mockRejectedValue(testError);
      jest
        .spyOn(databaseService, "dropTenantSchema")
        .mockResolvedValue(undefined);
      jest
        .spyOn(emailService, "sendProvisioningErrorEmail")
        .mockResolvedValue(undefined);

      await expect(service.provisionTenant(tenantData)).rejects.toThrow(
        "Schema creation failed",
      );

      expect(databaseService.dropTenantSchema).toHaveBeenCalled();
      expect(emailService.sendProvisioningErrorEmail).toHaveBeenCalled();
    });
  });

  describe("getProvisioningStatus", () => {
    it("should return provisioning status for a tenant", async () => {
      jest.spyOn(tenantRepository, "findOne").mockResolvedValue(mockTenant);

      const status = await service.getProvisioningStatus("test-id-123");

      expect(status).toBeDefined();
      expect(status.tenantId).toBe(mockTenant.id);
      expect(status.tenantName).toBe(mockTenant.name);
      expect(status.overallStatus).toBe(mockTenant.status);
    });

    it("should return null for non-existent tenant", async () => {
      jest.spyOn(tenantRepository, "findOne").mockResolvedValue(null);

      const status = await service.getProvisioningStatus("non-existent-id");

      expect(status).toBeNull();
    });
  });

  describe("deprovisionTenant", () => {
    it("should archive a tenant", async () => {
      jest.spyOn(tenantRepository, "findOne").mockResolvedValue(mockTenant);
      jest.spyOn(tenantRepository, "save").mockResolvedValue({
        ...mockTenant,
        status: TenantStatus.ARCHIVED,
        archivedAt: new Date(),
      });

      await service.deprovisionTenant("test-id-123");

      expect(tenantRepository.findOne).toHaveBeenCalledWith({
        where: { id: "test-id-123" },
      });
      expect(tenantRepository.save).toHaveBeenCalled();
    });

    it("should throw error if tenant not found", async () => {
      jest.spyOn(tenantRepository, "findOne").mockResolvedValue(null);

      await expect(
        service.deprovisionTenant("non-existent-id"),
      ).rejects.toThrow("Tenant not found");
    });
  });
});
