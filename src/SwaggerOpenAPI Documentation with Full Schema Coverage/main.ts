import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as basicAuth from 'express-basic-auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger (disabled in production) ──────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    // Protect Swagger UI with basic auth in staging
    if (process.env.NODE_ENV === 'staging') {
      app.use(
        ['/api/docs', '/api/docs-json'],
        basicAuth({
          challenge: true,
          users: {
            [process.env.SWAGGER_USER ?? 'admin']:
              process.env.SWAGGER_PASS ?? 'secret',
          },
        }),
      );
    }

    const config = new DocumentBuilder()
      .setTitle('My API')
      .setDescription(
        `## Overview\n\nRESTful API powering the platform.\n\n` +
          `### Authentication\nAll protected endpoints require a **Bearer JWT** token.\n` +
          `Obtain a token via \`POST /auth/login\` then click **Authorize** above.`,
      )
      .setVersion('1.0.0')
      .setContact('Platform Team', 'https://example.com', 'api@example.com')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addServer('http://localhost:3000', 'Local')
      .addServer('https://staging.example.com', 'Staging')
      .addServer('https://api.example.com', 'Production')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter your JWT token',
          in: 'header',
        },
        'access-token', // <-- security scheme key (used in @ApiBearerAuth('access-token'))
      )
      .addTag('auth', 'Authentication & session management')
      .addTag('users', 'User resource CRUD')
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
      deepScanRoutes: true,
    });

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,          // remember token across refreshes
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'My API – Swagger UI',
      customCss: `
        .swagger-ui .topbar { background: #1a1a2e; }
        .swagger-ui .topbar-wrapper img { display: none; }
      `,
    });

    console.log(`📖 Swagger UI → http://localhost:3000/api/docs`);
    console.log(`📄 OpenAPI JSON → http://localhost:3000/api/docs-json`);
  }

  await app.listen(3000);
}
bootstrap();
