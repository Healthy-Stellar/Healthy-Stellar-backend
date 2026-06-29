import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class SmartConfigController {
  @Get('.well-known/smart-configuration')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'SMART on FHIR discovery configuration' })
  getSmartConfiguration() {
    const baseUrl = process.env.FHIR_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

    return {
      authorization_endpoint: `${baseUrl}/oauth2/authorize`,
      token_endpoint: `${baseUrl}/oauth2/token`,
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
      grant_types_supported: ['authorization_code'],
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: [
        'openid',
        'fhirUser',
        'launch/patient',
        'patient/*.read',
        'patient/*.write',
        'patient/*.*',
        'user/*.read',
        'user/*.write',
        'user/*.*',
        'offline_access',
      ],
      capabilities: [
        'launch-ehr',
        'launch-standalone',
        'client-public',
        'client-confidential-symmetric',
        'sso-openid-connect',
        'context-passthrough-banner',
        'context-passthrough-style',
        'context-ehr-patient',
        'context-ehr-encounter',
        'context-standalone-patient',
        'permission-offline',
        'permission-patient',
        'permission-user',
        'smart-style-url',
      ],
    };
  }
}
