import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { OnboardingService } from '../services/onboarding.service';
import {
  ConfigureHospitalDto,
  RegisterHospitalDto,
  VerifyEmailDto,
} from '../dto/onboarding.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterHospitalDto) {
    return this.service.register(dto);
  }

  @Post(':id/verify')
  verify(@Param('id') id: string, @Body() dto: VerifyEmailDto) {
    return this.service.verify(id, dto);
  }

  @Post(':id/configure')
  configure(@Param('id') id: string, @Body() dto: ConfigureHospitalDto) {
    return this.service.configure(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Get(':tenantId/status')
  getStatus(@Param('tenantId') tenantId: string) {
    return this.service.getStatus(tenantId);
  }
}
