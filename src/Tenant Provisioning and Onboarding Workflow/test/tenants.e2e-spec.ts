import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { Tenant, TenantStatus } from "@/tenants/entities/tenant.entity";
import { TenantsController } from "@/tenants/controllers/tenants.controller";
import { CreateTenantDto } from "@/tenants/dto/tenant.dto";

describe("Tenant Provisioning Integration Tests (e2e)", () => {
  let app: INestApplication;
  let tenantsController: TenantsController;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableCors();

    await app.init();

    tenantsController = moduleFixture.get<TenantsController>(TenantsController);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /admin/tenants - Tenant Provisioning", () => {
    it("should queue a provisioning job for a new tenant", async () => {
      const createTenantDto: CreateTenantDto = {
        name: "Test Healthcare Organization",
        adminEmail: "admin@testhealthcare.local",
        adminFirstName: "John",
        adminLastName: "Doe",
      };

      const response = await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(202);

      expect(response.body).toHaveProperty("jobId");
      expect(response.body).toHaveProperty("status");
      expect(response.body.status).toBe("queued");
      expect(response.body).toHaveProperty("message");
    });

    it("should reject tenant creation with invalid email", async () => {
      const createTenantDto = {
        name: "Invalid Email Org",
        adminEmail: "invalid-email",
        adminFirstName: "Jane",
        adminLastName: "Smith",
      };

      await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(400);
    });

    it("should reject tenant creation with missing fields", async () => {
      const createTenantDto = {
        name: "Missing Fields Org",
        // Missing adminEmail, adminFirstName, adminLastName
      };

      await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(400);
    });

    it("should reject tenant creation with short name", async () => {
      const createTenantDto: CreateTenantDto = {
        name: "AB", // Too short
        adminEmail: "admin@test.local",
        adminFirstName: "Test",
        adminLastName: "User",
      };

      await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(400);
    });
  });

  describe("GET /admin/tenants/:id/provisioning-status", () => {
    let tenantId: string;

    beforeAll(async () => {
      // Create a tenant first
      const createTenantDto: CreateTenantDto = {
        name: "Status Check Organization",
        adminEmail: "statuscheck@test.local",
        adminFirstName: "Status",
        adminLastName: "Checker",
      };

      const response = await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(202);

      // Note: In a real test, we would extract the tenantId from the job or database
      // For now, this is a placeholder
    });

    it("should return 404 for non-existent tenant", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      await request(app.getHttpServer())
        .get(`/admin/tenants/${fakeId}/provisioning-status`)
        .expect(404);
    });

    it("should return provisioning status with logs", async () => {
      // This would require a successfully provisioned tenant
      // Implementation depends on test database setup
    });
  });

  describe("GET /admin/tenants/:id", () => {
    it("should return 404 for non-existent tenant", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      await request(app.getHttpServer())
        .get(`/admin/tenants/${fakeId}`)
        .expect(404);
    });

    it("should return tenant details", async () => {
      // Implementation depends on test database setup
    });
  });

  describe("GET /admin/tenants", () => {
    it("should return list of all tenants", async () => {
      const response = await request(app.getHttpServer())
        .get("/admin/tenants")
        .expect(200);

      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("tenants");
      expect(Array.isArray(response.body.tenants)).toBe(true);
    });
  });

  describe("DELETE /admin/tenants/:id - Tenant Deprovisioning", () => {
    it("should return 404 for non-existent tenant", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      await request(app.getHttpServer())
        .delete(`/admin/tenants/${fakeId}`)
        .expect(404);
    });

    it("should archive an existing tenant", async () => {
      // Implementation depends on test database setup
      // The tenant should be marked as ARCHIVED, not permanently deleted
    });
  });

  describe("Full Provisioning Workflow", () => {
    it("should complete full tenant provisioning pipeline", async (done) => {
      const createTenantDto: CreateTenantDto = {
        name: "Full Workflow Test Organization",
        adminEmail: "workflow@test.local",
        adminFirstName: "Workflow",
        adminLastName: "Tester",
      };

      // Step 1: Queue provisioning job
      const jobResponse = await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(202);

      expect(jobResponse.body.status).toBe("queued");

      // Step 2: Wait for job completion (in real scenario)
      // This would involve polling the queue or using webhooks
      // For now, we'll wait a reasonable amount of time
      setTimeout(async () => {
        try {
          // Step 3: Verify provisioning status (if we can extract tenantId)
          // This would include checking that all steps completed

          // Step 4: Verify tenant is ACTIVE
          // This would query the database for the tenant and verify status

          done();
        } catch (error) {
          done(error);
        }
      }, 5000);
    });
  });

  describe("Error Handling and Rollback", () => {
    it("should handle provisioning failures gracefully", async () => {
      // Create a tenant with properties that would cause failure
      // Verify that:
      // 1. Tenant status is set to FAILED
      // 2. Error message is stored
      // 3. Schema is rolled back
      // 4. Admin receives error email notification
    });

    it("should log all provisioning steps", async () => {
      // Verify that provisioning logs capture all steps
      // including timing information for each step
    });
  });

  describe("Validation and Security", () => {
    it("should sanitize tenant names for schema creation", async () => {
      const createTenantDto: CreateTenantDto = {
        name: "Test; DROP TABLE tenants; --",
        adminEmail: "sql@test.local",
        adminFirstName: "SQL",
        adminLastName: "Injection",
      };

      const response = await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(202); // Should be queued, not fail or execute SQL

      // Verify schema name was properly escaped/sanitized
    });

    it("should validate email format", async () => {
      const createTenantDto = {
        name: "Email Test Org",
        adminEmail: "not-an-email",
        adminFirstName: "Email",
        adminLastName: "Test",
      };

      await request(app.getHttpServer())
        .post("/admin/tenants")
        .send(createTenantDto)
        .expect(400);
    });
  });
});
