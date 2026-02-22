// scripts/export-openapi.ts
/**
 * Bootstraps the NestJS application without starting the HTTP server,
 * generates the OpenAPI document, and writes it to /docs/openapi.json.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/export-openapi.ts
 * Or add to package.json: "docs:generate": "ts-node -r tsconfig-paths/register scripts/export-openapi.ts"
 */

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  console.log('⚙️  Bootstrapping app (no HTTP listener)…');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'], // quiet during script run
  });

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('Auto-generated OpenAPI specification')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
    deepScanRoutes: true,
  });

  const outputDir = resolve(__dirname, '..', 'docs');
  const outputPath = resolve(outputDir, 'openapi.json');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');

  console.log(`✅ OpenAPI spec written to ${outputPath}`);
  console.log(
    `   Paths documented: ${Object.keys(document.paths).length}`,
  );
  console.log(
    `   Schemas exported: ${Object.keys(document.components?.schemas ?? {}).length}`,
  );

  await app.close();
  process.exit(0);
}

exportOpenApi().catch((err) => {
  console.error('❌ Failed to export OpenAPI spec:', err);
  process.exit(1);
});
