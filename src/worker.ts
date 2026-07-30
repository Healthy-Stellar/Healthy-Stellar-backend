import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('WorkerProcess');

  try {
    const app = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['error', 'warn', 'log'],
    });

    logger.log('Worker process started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.log('Received SIGTERM, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('Received SIGINT, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start worker process', error);
    process.exit(1);
  }
}

bootstrap();