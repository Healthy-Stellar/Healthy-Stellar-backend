import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { I18nValidationPipe, I18nService } from 'nestjs-i18n';
import { CustomI18nValidationFilter } from './../src/common/filters/i18n-validation.filter';

describe('I18n Validation Errors (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const i18nService = app.get(I18nService);
    
    app.useGlobalPipes(new I18nValidationPipe({ whitelist: true }));
    app.useGlobalFilters(new CustomI18nValidationFilter(i18nService));
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Assuming POST /medical-records requires a non-empty string for 'patientId'
  const invalidPayload = { patientId: '' }; 

  it('should return English validation errors by default', () => {
    return request(app.getHttpServer())
      .post('/medical-records')
      .send(invalidPayload)
      .expect(400)
      .expect((res) => {
        const error = res.body.errors[0];
        expect(error.constraints.isNotEmpty).toEqual('patientId should not be empty.');
      });
  });

  it('should return French validation errors when Accept-Language is fr', () => {
    return request(app.getHttpServer())
      .post('/medical-records')
      .set('Accept-Language', 'fr')
      .send(invalidPayload)
      .expect(400)
      .expect((res) => {
        const error = res.body.errors[0];
        expect(error.constraints.isNotEmpty).toEqual('patientId ne doit pas être vide.');
      });
  });

  it('should return Spanish validation errors when Accept-Language is es', () => {
    return request(app.getHttpServer())
      .post('/medical-records')
      .set('Accept-Language', 'es')
      .send(invalidPayload)
      .expect(400)
      .expect((res) => {
        const error = res.body.errors[0];
        expect(error.constraints.isNotEmpty).toEqual('patientId no debe estar vacío.');
      });
  });
});