import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';

@Version(VERSION_NEUTRAL)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('i18n/supported-languages')
  getSupportedLanguages(): string[] {
    return ['en', 'fr', 'es', 'ar'];
  }
}
