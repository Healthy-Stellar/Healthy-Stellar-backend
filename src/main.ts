import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
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
    .setDescription(`
      **HIPAA-Compliant Healthcare Management System**
      
      ⚠️ **MEDICAL DATA PRIVACY NOTICE**
      This API handles Protected Health Information (PHI). All data is encrypted and access is logged for compliance.
      
      **HL7 FHIR R4 Compatible**
      - Supports FHIR resource types
      - Implements medical coding standards (ICD-10, SNOMED CT)
      - Maintains audit trails per HIPAA requirements
      
      **Security & Compliance**
      - All endpoints require authentication
      - Medical data is anonymized in examples
      - Audit logging for all operations
      - End-to-end encryption
    `)
    .setVersion('1.0.0')
    .setContact('Medical IT Team', 'https://medical-system.com', 'medical-it@hospital.com')
    .setLicense('Medical License', 'https://medical-system.com/license')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Medical staff authentication token'
    }, 'medical-auth')
    .addTag('Medical Records', 'Patient medical record management')
    .addTag('Clinical Templates', 'Standardized clinical documentation')
    .addTag('Consent Management', 'Patient consent and data sharing')
    .addTag('File Attachments', 'Medical document and image management')
    .addTag('Reporting', 'Medical analytics and compliance reports')
    .addServer('https://api.medical-system.com', 'Production Server')
    .addServer('https://staging-api.medical-system.com', 'Staging Server')
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
      showCommonExtensions: true
    }
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🏥 Medical System API: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api`);
}

bootstrap();
