import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { VersionDeprecationInterceptor } from './common/interceptors/version-deprecation.interceptor';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── API Versioning ──────────────────────────────────────────────────────
  // URI-based versioning: /v1/records, /v2/records …
  // defaultVersion: '1' ensures unversioned clients are handled gracefully —
  // a request to /records resolves to the same handler as /v1/records.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Deprecation headers ─────────────────────────────────────────────────
  // Global interceptor injects Sunset / Deprecation / Link headers on any
  // route decorated with @Deprecated().
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new VersionDeprecationInterceptor(reflector));

  // Security Headers - Helmet Configuration
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
          scriptSrc: ["'self'"], // No unsafe-inline or unsafe-eval
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Required for Swagger UI
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    }),
  );

  // Remove X-Powered-By header
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // CORS Configuration with explicit origin whitelist
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: corsOrigins,
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      // API versioning deprecation headers (RFC 8594 / IETF draft)
      'Deprecation',
      'Sunset',
      'Link',
    ],
    maxAge: 3600,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Medical-Grade API Documentation
  const config = new DocumentBuilder()
    .setTitle('Medical Records Management API')
    .setDescription(
      `
      **HIPAA-Compliant Healthcare Management System**
      
      ⚠️ **MEDICAL DATA PRIVACY NOTICE**
      This API handles Protected Health Information (PHI). All data is encrypted and access is logged for compliance.
      
      **HL7 FHIR R4 Compatible**
      - Supports FHIR resource types
      - Implements medical coding standards (ICD-10, SNOMED CT)
      - Maintains audit trails per HIPAA requirements
      
      **API Versioning**
      - Current stable version: **v1**
      - All routes are served under \`/v1/\` prefix (e.g. \`GET /v1/records\`)
      - Unversioned requests resolve to v1 (default)
      - Health and metadata endpoints are version-neutral (\`/health\`, \`/\`)
      
      **Security & Compliance**
      - All endpoints require authentication
      - Medical data is anonymized in examples
      - Audit logging for all operations
      - End-to-end encryption
    `,
    )
    .setVersion('1.0.0')
    .setContact('Medical IT Team', 'https://medical-system.com', 'medical-it@hospital.com')
    .setLicense('Medical License', 'https://medical-system.com/license')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Medical staff authentication token',
      },
      'medical-auth',
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
    .addServer('https://api.medical-system.com/v1', 'Production — v1')
    .addServer('https://staging-api.medical-system.com/v1', 'Staging — v1')
    .addServer('http://localhost:3000/v1', 'Local Development — v1')
    .build();

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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🏥 Medical System API: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api`);
  console.log(`🔖 Versioned base URL: http://localhost:${port}/v1`);
}

bootstrap();
