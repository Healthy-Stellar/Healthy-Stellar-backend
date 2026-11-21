import './tracing'; // Initialize tracing before any other imports
import { NestFactory, Reflector } from '@nestjs/core';
import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { I18nValidationPipe, I18nService } from 'nestjs-i18n';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomI18nValidationFilter } from './common/filters/i18n-validation.filter';
import { nonceMiddleware } from './common/middleware/nonce.middleware';
import { DeprecationInterceptor } from './common/interceptors/deprecation.interceptor';
import { Logger } from 'nestjs-pino';
import { applySecurityHeaders } from './security/http-security.config';
import { ApiVersionLifecycleInterceptor } from './versioning/api-version-lifecycle.interceptor';
import { API_BEARER_AUTH_SCHEME } from './common/constants/swagger.constants';

/**
 * Parse a comma-separated list of `Name|URL` (or bare `URL`) entries into
 * Swagger server definitions. Falls back to a relative server so that
 * "Try it out" always targets the host serving the docs.
 */
function parseSwaggerServers(raw?: string): Array<{ url: string; description: string }> {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return [{ url: '/', description: 'Current server' }];
  }

  return entries.map((entry) => {
    const [first, second] = entry.split('|').map((part) => part.trim());
    if (second) {
      return { url: second, description: first };
    }
    return { url: first, description: first };
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Run onModuleDestroy/onApplicationShutdown hooks (Redis locks, DB pools, etc.) on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Use Pino logger
  app.useLogger(app.get(Logger));
  app.flushLogs();

  // Enable URI-based API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    // Set default version to 1, and fall back to VERSION_NEUTRAL for unversioned routes.
    defaultVersion: ['1', VERSION_NEUTRAL],
  });

  // Generate the nonce before Helmet evaluates the shared CSP configuration.
  app.use(nonceMiddleware);
  // Keep runtime headers aligned with the security-header integration test.
  applySecurityHeaders(app);

  // Remove X-Powered-By header
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // CORS Configuration
  const isProd = process.env.NODE_ENV === 'production';
  const defaultOrigins = isProd
    ? []
    : ['http://localhost:3000', 'http://localhost:4200'];
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : defaultOrigins;

  if (isProd && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be set in production');
  }

  // Extra headers can be appended per deployment via comma-separated env vars
  const parseHeaderList = (value?: string) =>
    value ? value.split(',').map((h) => h.trim()).filter(Boolean) : [];

  app.enableCors({
    origin: allowedOrigins,
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Trace-ID',
      'X-Request-Id',
      'Idempotency-Key',
      'If-Match',
      'Accept-Language',
      ...parseHeaderList(process.env.CORS_ALLOWED_HEADERS),
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Trace-ID',
      'X-Request-Id',
      'ETag',
      'Idempotent-Replayed',
      'Deprecation',
      'Sunset',
      'Link',
      'API-Version',
      'API-Version-Status',
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-RateLimit-Category',
      ...parseHeaderList(process.env.CORS_EXPOSED_HEADERS),
    ],
    maxAge: 3600,
  });

  app.useGlobalInterceptors(
    new ApiVersionLifecycleInterceptor(),
    new DeprecationInterceptor(app.get(Reflector)),
  );

  const i18nService = app.get(I18nService);
  app.useGlobalFilters(
    new CustomI18nValidationFilter(i18nService),
    new GlobalExceptionFilter(),
  );
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Medical-Grade API Documentation
  const swaggerServers = parseSwaggerServers(process.env.SWAGGER_SERVER_URLS);
  const contactName = process.env.SWAGGER_CONTACT_NAME;
  const contactEmail = process.env.SWAGGER_CONTACT_EMAIL;
  const contactUrl = process.env.SWAGGER_CONTACT_URL;
  const licenseName = process.env.SWAGGER_LICENSE_NAME;
  const licenseUrl = process.env.SWAGGER_LICENSE_URL;

  const builder = new DocumentBuilder()
    .setTitle('Medical Records Management API')
    .setDescription(
      `
      **HIPAA-Compliant Healthcare Management System**
      
      ⚠️ **MEDICAL DATA PRIVACY NOTICE**
      This API handles Protected Health Information (PHI). Access is authenticated and audited for compliance.
      
      **HL7 FHIR R4 Compatible**
      - Supports FHIR resource types
      - Implements medical coding standards (ICD-10, SNOMED CT)
      - Maintains audit trails per HIPAA requirements
      
      **Authentication Model**
      - Most endpoints require a bearer JWT (\`Authorization: Bearer <token>\`) issued by the identity service.
      - Service-to-service integrations may authenticate with an API key header.
      - Routes marked \`@Public\` are intentionally unauthenticated, e.g. health checks,
        CDS discovery (\`/cds-services\`), and unsubscribe links. Do not send credentials to them.
      - Role- and consent-based authorization is enforced per resource; a valid token does not
        imply access to every patient record.
      
      **Data Protection**
      - PHI columns are protected with envelope encryption at rest (per-record data keys wrapped
        by a KMS-managed master key). This is encryption at rest, not end-to-end encryption.
      - Example payloads use synthetic data only; never submit real PHI to the documentation UI.
      - Audit logging is recorded for all operations.
      
      ---
      
      ## Error Handling Guide
      
      All errors follow a standardized response format with machine-readable error codes:
      
      \`\`\`json
      {
        "statusCode": 409,
        "error": "Conflict",
        "message": "Resource version conflict",
        "code": "RECORD_VERSION_CONFLICT",
        "traceId": "550e8400-e29b-41d4-a716-446655440000",
        "timestamp": "2024-05-30T10:30:45.123Z",
        "path": "/api/v1/medical-records/123",
        "details": {
          "expectedVersion": "1",
          "currentVersion": "2"
        }
      }
      \`\`\`
      
      **Handle errors using the \`code\` field, not HTTP status codes.** Error codes are stable and SDK-friendly.
      
      ### Common Error Codes
      
      - \`VALIDATION_ERROR\` - Input validation failed
      - \`UNAUTHORIZED\` - Missing/invalid authentication
      - \`FORBIDDEN\` - Insufficient permissions
      - \`NOT_FOUND\` - Resource not found
      - \`RECORD_VERSION_CONFLICT\` - Optimistic locking conflict (use If-Match header)
      - \`PATIENT_NOT_FOUND\` - Patient not found
      - \`ACCESS_DENIED\` - Access control violation
      - \`FHIR_VALIDATION_ERROR\` - FHIR resource validation failed
      
      See the **Error Responses** section for detailed error code documentation.
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Medical staff authentication token',
      },
      API_BEARER_AUTH_SCHEME,
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for service-to-service integrations',
      },
      'api-key',
    )
    .addTag('Medical Records', 'Patient medical record management')
    .addTag('Clinical Templates', 'Standardized clinical documentation')
    .addTag('Consent Management', 'Patient consent and data sharing')
    .addTag('File Attachments', 'Medical document and image management')
    .addTag('Reporting', 'Medical analytics and compliance reports')
    .addTag('Billing & Invoicing', 'Patient billing and invoice management')
    .addTag('Payment Processing', 'Payment collection and reconciliation')
    .addTag('Insurance Claims', 'Insurance claim submission and tracking')
    .addTag('Insurance Verification', 'Eligibility and benefits verification')
    .addTag('Financial Reporting & Analytics', 'Revenue cycle and financial analytics')
    .addTag('Pharmacy Management', 'Drug inventory and prescription management')
    .addTag('Laboratory Management', 'Lab test ordering and result management')
    .addTag('Patients', 'Patient demographics and registration')
    .addTag('Appointments', 'Scheduling and appointment management')
    .addTag('Prescriptions', 'Prescription lifecycle management')
    .addTag('Allergies', 'Allergy and intolerance records')
    .addTag('Immunizations', 'Vaccination records')
    .addTag('Diagnoses', 'Diagnosis and problem list management')
    .addTag('Vitals', 'Vital signs capture and history')
    .addTag('Documents', 'Clinical document management')
    .addTag('Audit', 'Audit trail and access logs')
    .addTag('Authentication', 'Login, token issuance and session management')
    .addTag('Users & Roles', 'User accounts and role administration')
    .addTag('Notifications', 'Alerts and notification delivery')
    .addTag('Messaging', 'Secure patient and provider messaging')
    .addTag('Telemedicine', 'Virtual visit sessions')
    .addTag('Scheduling', 'Resource and calendar scheduling')
    .addTag('Inventory', 'Medical supply and stock management')
    .addTag('Integrations', 'External system integrations and HL7/FHIR exchange')
    .addTag('FHIR', 'HL7 FHIR R4 resource endpoints')
    .addTag('CDS Hooks', 'Clinical decision support discovery and services')
    .addTag('Health', 'Liveness and readiness probes (public)')
    .addTag('Subscriptions', 'Webhook and event subscriptions')
    .addTag('Unsubscribe', 'Public unsubscribe links')
    .addTag('Admin', 'Administrative and maintenance operations')
    .addTag('Error Responses', 'Standard error response format and error codes');

  if (contactName || contactEmail || contactUrl) {
    builder.setContact(contactName ?? '', contactUrl ?? '', contactEmail ?? '');
  }
  if (licenseName) {
    builder.setLicense(licenseName, licenseUrl);
  }
  for (const server of swaggerServers) {
    builder.addServer(server.url, server.description);
  }

  const config = builder.build();

  const document = SwaggerModule.createDocument(app, config);

  // Custom CSS for medical branding
  const customCss = `
    .swagger-ui .topbar { background-color: #2c5aa0; }
    .swagger-ui .info .title { color: #2c5aa0; }
    .swagger-ui .scheme-container { background: #f8f9fa; padding: 10px; border-left: 4px solid #dc3545; }
    .swagger-ui .info .description p:first-child { 
      background: #fff3cd; 
      border: 1px solid #ffeaa7; 
      padding: 10px; 
      border-radius: 4px;
      font-weight: bold;
    }
  `;

  // The route map is only exposed outside production unless SWAGGER_ENABLED=true is set explicitly
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    SwaggerModule.setup('api', app, document, {
      customCss,
      customSiteTitle: 'Medical API Documentation',
      customfavIcon: '/favicon-medical.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      },
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🏥 Medical System API: http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`📚 API Documentation: http://localhost:${port}/api`);
  }
}

bootstrap();
