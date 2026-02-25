import { Module, Global } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { CustomLoggerService } from './custom-logger.service';
import { loggerConfig } from '../../config/logger.config';

@Global()
@Module({
  imports: [PinoLoggerModule.forRoot(loggerConfig)],
  providers: [CustomLoggerService],
  exports: [CustomLoggerService, PinoLoggerModule],
})
export class LoggerModule {}
