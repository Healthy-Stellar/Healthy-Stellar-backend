import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from './common/logger/custom-logger.service';

@Injectable()
export class AppService {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('AppService');
  }

  getHello(): string {
    this.logger.log('Health check endpoint accessed');
    return 'Hello World!';
  }
}
