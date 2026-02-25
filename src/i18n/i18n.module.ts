import { Module } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { I18nController } from './i18n.controller';
import { I18nValidationPipe } from './pipes/i18n-validation.pipe';
import { I18nExceptionFilter } from './filters/i18n-exception.filter';

@Module({
  controllers: [I18nController],
  providers: [I18nService, I18nValidationPipe, I18nExceptionFilter],
  exports: [I18nService, I18nValidationPipe, I18nExceptionFilter],
})
export class I18nAppModule {}
