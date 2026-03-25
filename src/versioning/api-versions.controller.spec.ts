import { Test, TestingModule } from '@nestjs/testing';
import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiVersionsController } from './api-versions.controller';

describe('ApiVersionsController', () => {
  let controller: ApiVersionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiVersionsController],
    }).compile();

    controller = module.get<ApiVersionsController>(ApiVersionsController);
  });

  describe('getVersions', () => {
    it('returns a versions array', () => {
      const result = controller.getVersions();
      expect(result).toHaveProperty('versions');
      expect(Array.isArray(result.versions)).toBe(true);
    });

    it('includes v1 as current', () => {
      const { versions } = controller.getVersions();
      const v1 = versions.find((v) => v.version === '1');
      expect(v1).toBeDefined();
      expect(v1?.status).toBe('current');
    });

    it('every version has required fields', () => {
      const { versions } = controller.getVersions();
      for (const v of versions) {
        expect(v.version).toBeDefined();
        expect(v.status).toMatch(/^(current|deprecated|sunset)$/);
        expect(v.releaseDate).toBeDefined();
        expect(v.baseUrl).toBeDefined();
      }
    });

    it('v1 baseUrl is /v1', () => {
      const { versions } = controller.getVersions();
      const v1 = versions.find((v) => v.version === '1');
      expect(v1?.baseUrl).toBe('/v1');
    });
  });
});
