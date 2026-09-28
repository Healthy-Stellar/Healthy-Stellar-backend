import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CriticalValuesService } from './critical-values.service';
import {
  AcknowledgeCriticalValueDto,
  CreateCriticalValueDefinitionDto,
  UpdateCriticalValueDefinitionDto,
} from './dto/critical-values.dto';

@Controller('laboratory/critical-values')
@UseGuards(JwtAuthGuard)
export class CriticalValuesController {
  constructor(private readonly criticalValuesService: CriticalValuesService) {}

  @Get('definitions')
  async listDefinitions(@Query('tenantId') tenantId?: string) {
    return this.criticalValuesService.listDefinitions(tenantId);
  }

  @Post('definitions')
  async createDefinition(@Body() dto: CreateCriticalValueDefinitionDto) {
    return this.criticalValuesService.createDefinition(dto);
  }

  @Put('definitions/:id')
  async updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateCriticalValueDefinitionDto,
  ) {
    return this.criticalValuesService.updateDefinition(id, dto);
  }

  @Delete('definitions/:id')
  async deleteDefinition(@Param('id') id: string) {
    return this.criticalValuesService.deleteDefinition(id);
  }

  @Get()
  async listCriticalValues(@Query('tenantId') tenantId?: string) {
    return this.criticalValuesService.listCriticalValues(tenantId);
  }

  @Post(':id/acknowledge')
  async acknowledge(
    @Param('id') id: string,
    @Body() dto: AcknowledgeCriticalValueDto,
  ) {
    return this.criticalValuesService.acknowledge(id, dto);
  }
}
