import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { ConfigService } from "@nestjs/config";

jest.mock("@nestjs/event-emitter", () => ({
  EventEmitter2: class EventEmitter2 {
    emit = jest.fn();
    on = jest.fn();
  },
}));

import { EventEmitter2 } from "@nestjs/event-emitter";
import { AuditService } from "./audit.service";
import { AuditLog, AuditAction, AuditSeverity } from "./audit-log.entity";
import { EncryptionService } from "./encryption.service";

let walStore: string[] = [];

const mockRedis = {
  rpush: jest.fn(),
  lrange: jest.fn(),
  ltrim: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock("ioredis", () => {
  const RedisMock = jest.fn(() => mockRedis);
  (RedisMock as any).default = RedisMock;
  return RedisMock;
});

const mockAuditLogRepository = () => ({
  save: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockEncryptionService = {
  hashIdentifier: jest.fn((val: string) => `hashed:${val}`),
  createIntegritySignature: jest.fn(() => "mock-integrity-hash"),
};

const mockEventEmitter = { emit: jest.fn() };

const mockConfigService = {
  get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
};

function resetWalMocks() {
  walStore = [];
  mockRedis.rpush.mockImplementation(async (_key: string, value: string) => {
    walStore.push(value);
    return walStore.length;
  });
  mockRedis.lrange.mockImplementation(async (_key: string, start: number, end: number) => {
    return end === -1 ? walStore.slice(start) : walStore.slice(start, end + 1);
  });
  mockRedis.ltrim.mockImplementation(async (_key: string, start: number) => {
    walStore = walStore.slice(start);
    return "OK";
  });
  mockRedis.disconnect.mockResolvedValue(undefined);
}

describe("AuditService", () => {
  let service: AuditService;
  let repo: jest.Mocked<Repository<AuditLog>>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useFactory: mockAuditLogRepository },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = module.get(getRepositoryToken(AuditLog));
    service.onModuleInit();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetWalMocks();
    repo.save.mockResolvedValue({} as AuditLog);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("log", () => {
    it("should emit audit.logged event for all logs", async () => {
      await service.log({ action: AuditAction.PHI_ACCESS, resource: "/patients/123", userId: "u1" });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith("audit.logged", expect.any(Object));
    });

    it("should immediately persist CRITICAL severity logs", async () => {
      await service.log({ action: AuditAction.SECURITY_VIOLATION, severity: AuditSeverity.CRITICAL, resource: "/admin", userId: "u1" });
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(mockRedis.rpush).not.toHaveBeenCalled();
    });

    it("should immediately persist EMERGENCY severity logs", async () => {
      await service.log({ action: AuditAction.BREACH_REPORTED, severity: AuditSeverity.EMERGENCY, resource: "/incident" });
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(mockRedis.rpush).not.toHaveBeenCalled();
    });

    it("should write non-critical PHI_ACCESS logs to Redis WAL instead of DB", async () => {
      await service.log({ action: AuditAction.PHI_ACCESS, resource: "/patients", userId: "u1" });
      expect(repo.save).not.toHaveBeenCalled();
      expect(mockRedis.rpush).toHaveBeenCalledWith("audit:wal", expect.any(String));
      expect(walStore).toHaveLength(1);
    });

    it("should write authentication events to Redis WAL", async () => {
      await service.log({ action: AuditAction.LOGIN_SUCCESS, resource: "/auth/login", userId: "u1" });
      expect(repo.save).not.toHaveBeenCalled();
      expect(walStore).toHaveLength(1);
    });

    it("should hash patient ID before storing", async () => {
      await service.log({ action: AuditAction.PHI_ACCESS, resource: "/patients/123", patientId: "patient-999", severity: AuditSeverity.CRITICAL });
      expect(mockEncryptionService.hashIdentifier).toHaveBeenCalledWith("patient-999");
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ patientIdHash: "hashed:patient-999" }));
    });

    it("should include integrity hash in all audit entries", async () => {
      await service.log({ action: AuditAction.LOGIN_SUCCESS, resource: "/auth/login", severity: AuditSeverity.CRITICAL });
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ integrityHash: "mock-integrity-hash" }));
    });
  });

  describe("WAL - write-ahead log durability", () => {
    it("writeToWal should RPUSH serialised entry to Redis", async () => {
      const entry = { action: AuditAction.PHI_ACCESS, resource: "/patients/1" };
      await service.writeToWal(entry);
      expect(mockRedis.rpush).toHaveBeenCalledWith("audit:wal", JSON.stringify(entry));
      expect(walStore).toHaveLength(1);
    });

    it("flushWal should move WAL entries from Redis to PostgreSQL", async () => {
      walStore = [
        JSON.stringify({ action: AuditAction.PHI_ACCESS, resource: "/p/1" }),
        JSON.stringify({ action: AuditAction.PHI_ACCESS, resource: "/p/2" }),
        JSON.stringify({ action: AuditAction.LOGIN_SUCCESS, resource: "/auth" }),
      ];
      await service.flushWal();
      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ resource: "/p/1" }),
          expect.objectContaining({ resource: "/p/2" }),
          expect.objectContaining({ resource: "/auth" }),
        ]),
      );
      expect(walStore).toHaveLength(0);
    });

    it("flushWal should be a no-op when WAL is empty", async () => {
      await service.flushWal();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("should fall back to direct DB persist when Redis is unavailable", async () => {
      mockRedis.rpush.mockRejectedValueOnce(new Error("Redis connection refused"));
      await service.log({ action: AuditAction.PHI_ACCESS, resource: "/patients/fallback", userId: "u1" });
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it("crash recovery: events written to WAL before crash are recoverable on restart", async () => {
      const precrashEntries = [
        { action: AuditAction.PHI_ACCESS, resource: "/patients/crash-1", userId: "u1" },
        { action: AuditAction.PHI_UPDATE, resource: "/patients/crash-2", userId: "u2" },
        { action: AuditAction.LOGIN_FAILURE, resource: "/auth/login", userId: "u3" },
      ];

      for (const e of precrashEntries) {
        await service.writeToWal(e);
      }

      expect(walStore).toHaveLength(3);
      expect(repo.save).not.toHaveBeenCalled();

      await service.flushWal();

      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ resource: "/patients/crash-1" }),
          expect.objectContaining({ resource: "/patients/crash-2" }),
          expect.objectContaining({ resource: "/auth/login" }),
        ]),
      );
      expect(walStore).toHaveLength(0);
    });
  });

  describe("onApplicationShutdown", () => {
    it("should flush WAL and disconnect Redis on shutdown", async () => {
      walStore = [JSON.stringify({ action: AuditAction.PHI_ACCESS, resource: "/patients/1" })];
      await service.onApplicationShutdown("SIGTERM");
      expect(repo.save).toHaveBeenCalled();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });

  describe("logPhiAccess", () => {
    it("should log PHI access with correct action", async () => {
      const logSpy = jest.spyOn(service, "log");
      await service.logPhiAccess("u1", "patient-1", "/patients/1", AuditAction.PHI_ACCESS);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", patientId: "patient-1", resource: "/patients/1", action: AuditAction.PHI_ACCESS }),
      );
    });
  });

  describe("logSecurityViolation", () => {
    it("should log with CRITICAL severity and emit security.violation event", async () => {
      await service.logSecurityViolation({ resource: "/admin", userId: "u1", ipAddress: "1.2.3.4" }, "SQL injection attempt");
      expect(mockEventEmitter.emit).toHaveBeenCalledWith("security.violation", expect.objectContaining({ reason: "SQL injection attempt" }));
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.SECURITY_VIOLATION, severity: AuditSeverity.CRITICAL }));
    });
  });

  describe("query", () => {
    it("should query with user ID filter", async () => {
      repo.findAndCount.mockResolvedValue([[{} as AuditLog], 1]);
      const result = await service.query({ userId: "u1" });
      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "u1" }) }));
      expect(result.total).toBe(1);
    });

    it("should hash patient ID for query", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.query({ patientId: "patient-123" });
      expect(mockEncryptionService.hashIdentifier).toHaveBeenCalledWith("patient-123");
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patientIdHash: "hashed:patient-123" }) }),
      );
    });

    it("should apply date range filter when both dates provided", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const start = new Date("2024-01-01");
      const end = new Date("2024-12-31");
      await service.query({ startDate: start, endDate: end });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ createdAt: Between(start, end) }) }),
      );
    });

    it("should apply pagination", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.query({ limit: 25, offset: 50 });
      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 25, skip: 50 }));
    });
  });

  describe("detectAnomalies", () => {
    it("should return false when under threshold", async () => {
      repo.count.mockResolvedValue(50);
      const result = await service.detectAnomalies("u1");
      expect(result).toBe(false);
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith("audit.anomaly", expect.anything());
    });

    it("should return true and emit event when over threshold", async () => {
      repo.count.mockResolvedValue(150);
      const result = await service.detectAnomalies("u1");
      expect(result).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith("audit.anomaly", expect.objectContaining({ userId: "u1", count: 150 }));
    });
  });

  describe("generateActivityReport", () => {
    it("should return a structured activity report", async () => {
      const mockQB = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ action: "PHI_ACCESS", count: "100", severity: "INFO" }]),
      };
      repo.createQueryBuilder.mockReturnValue(mockQB as any);
      repo.count.mockResolvedValue(5);
      const report = await service.generateActivityReport(new Date("2024-01-01"), new Date("2024-12-31"));
      expect(report).toHaveProperty("period");
      expect(report).toHaveProperty("summary");
      expect(report).toHaveProperty("violations");
      expect(report).toHaveProperty("anomalies");
      expect(report).toHaveProperty("generatedAt");
    });
  });
});

