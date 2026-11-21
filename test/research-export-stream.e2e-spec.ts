import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { ResearchExportController } from '../src/research-export/research-export.controller';
import { ResearchExportService } from '../src/research-export/research-export.service';
import { ResearchAnonymizerService } from '../src/research-export/research-anonymizer.service';
import { AuditService } from '../src/common/audit/audit.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { MedicalRbacGuard } from '../src/roles/medical-rbac.guard';
import { MedicalRecord } from '../src/medical-records/entities/medical-record.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { AccessGrant } from '../src/access-control/entities/access-grant.entity';

class AllowWithUser implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    ctx.switchToHttp().getRequest().medicalUser = { id: 'researcher-1' };
    return true;
  }
}

describe('POST /research-export/anonymized (e2e)', () => {
  let app: INestApplication;
  const grantRepo = { findOne: jest.fn() };
  const recordRepo = { createQueryBuilder: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ResearchExportController],
      providers: [
        ResearchExportService,
        ResearchAnonymizerService,
        { provide: getRepositoryToken(AccessGrant), useValue: grantRepo },
        { provide: getRepositoryToken(MedicalRecord), useValue: recordRepo },
        { provide: getRepositoryToken(Patient), useValue: { find: jest.fn() } },
        { provide: AuditService, useValue: { logDataExport: jest.fn() } },
        { provide: ConfigService, useValue: { get: (_k: string, d?: string) => d } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowWithUser)
      .overrideGuard(MedicalRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('returns 403 for a user with RESEARCH_EXPORT permission but no active grant', async () => {
    grantRepo.findOne.mockResolvedValue(null);
    await request(app.getHttpServer()).post('/research-export/anonymized').send({}).expect(403);
    expect(recordRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
