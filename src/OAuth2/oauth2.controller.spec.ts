import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Controller } from './oauth2.controller';
import { OAuth2Service } from './oauth2.service';

describe('OAuth2Controller', () => {
  let controller: OAuth2Controller;
  let oauth2Service: { exchangeAuthorizationCode: jest.Mock };

  const originalFhirBaseUrl = process.env.FHIR_BASE_URL;
  const originalPort = process.env.PORT;

  beforeEach(async () => {
    oauth2Service = {
      exchangeAuthorizationCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuth2Controller],
      providers: [
        {
          provide: OAuth2Service,
          useValue: oauth2Service,
        },
      ],
    }).compile();

    controller = module.get<OAuth2Controller>(OAuth2Controller);
  });

  afterEach(() => {
    if (originalFhirBaseUrl === undefined) {
      delete process.env.FHIR_BASE_URL;
    } else {
      process.env.FHIR_BASE_URL = originalFhirBaseUrl;
    }

    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  describe('token endpoint fhirUser claim', () => {
    it('uses FHIR_BASE_URL when it is set', async () => {
      process.env.FHIR_BASE_URL = 'https://fhir.example.com';
      oauth2Service.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'access-token',
        userId: 'user-123',
      });

      const result = await controller.token({
        grant_type: 'authorization_code',
        code: 'auth-code',
        redirect_uri: 'https://app.example.com/callback',
        client_id: 'client-id',
      } as any);

      expect(result.fhirUser).toBe(
        'https://fhir.example.com/fhir/r4/Patient/user-123',
      );
    });

    it('falls back to localhost with PORT when FHIR_BASE_URL is unset', async () => {
      delete process.env.FHIR_BASE_URL;
      process.env.PORT = '4000';
      oauth2Service.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'access-token',
        userId: 'user-123',
      });

      const result = await controller.token({
        grant_type: 'authorization_code',
        code: 'auth-code',
        redirect_uri: 'https://app.example.com/callback',
        client_id: 'client-id',
      } as any);

      expect(result.fhirUser).toBe(
        'http://localhost:4000/fhir/r4/Patient/user-123',
      );
    });

    it('falls back to localhost:3000 when FHIR_BASE_URL and PORT are unset', async () => {
      delete process.env.FHIR_BASE_URL;
      delete process.env.PORT;
      oauth2Service.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'access-token',
        userId: 'user-123',
      });

      const result = await controller.token({
        grant_type: 'authorization_code',
        code: 'auth-code',
        redirect_uri: 'https://app.example.com/callback',
        client_id: 'client-id',
      } as any);

      expect(result.fhirUser).toBe(
        'http://localhost:3000/fhir/r4/Patient/user-123',
      );
    });
  });
});
