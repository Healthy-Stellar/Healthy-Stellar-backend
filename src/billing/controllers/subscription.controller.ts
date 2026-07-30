import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from '../services/subscription.service';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  CreatePatientSubscriptionDto,
  UpdatePatientSubscriptionDto,
  ChangeSubscriptionPlanDto,
  SubscriptionSearchDto,
} from '../dto/subscription.dto';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Subscription Plan Endpoints

  @Post('plans')
  async createPlan(@Body() createDto: CreateSubscriptionPlanDto) {
    return this.subscriptionService.createPlan(createDto);
  }

  @Get('plans')
  async getAllPlans(@Query('activeOnly') activeOnly?: string) {
    return this.subscriptionService.getAllPlans(activeOnly === 'true');
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: string) {
    return this.subscriptionService.findPlanById(id);
  }

  @Put('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() updateDto: UpdateSubscriptionPlanDto) {
    return this.subscriptionService.updatePlan(id, updateDto);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlan(@Param('id') id: string) {
    return this.subscriptionService.deletePlan(id);
  }

  // Patient Subscription Endpoints

  @Post('patient')
  async createSubscription(@Body() createDto: CreatePatientSubscriptionDto) {
    return this.subscriptionService.createSubscription(createDto);
  }

  @Get('patient/:patientId')
  async getPatientSubscriptions(@Param('patientId') patientId: string) {
    return this.subscriptionService.findSubscriptionByPatient(patientId);
  }

  @Get('patient/:patientId/active')
  async getActivePatientSubscription(@Param('patientId') patientId: string) {
    return this.subscriptionService.findActiveSubscriptionByPatient(patientId);
  }

  @Get(':id')
  async getSubscription(@Param('id') id: string) {
    return this.subscriptionService.findSubscriptionById(id);
  }

  @Get()
  async searchSubscriptions(@Query() searchDto: SubscriptionSearchDto) {
    return this.subscriptionService.searchSubscriptions(searchDto);
  }

  @Put(':id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateDto: UpdatePatientSubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(id, updateDto);
  }

  @Put(':id/plan')
  async changeSubscriptionPlan(
    @Param('id') id: string,
    @Body() changeDto: ChangeSubscriptionPlanDto,
  ) {
    return this.subscriptionService.changeSubscriptionPlan(id, changeDto);
  }

  @Post(':id/cancel')
  async cancelSubscription(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @Body('immediate') immediate?: boolean,
  ) {
    return this.subscriptionService.cancelSubscription(id, reason, immediate);
  }

  @Post(':id/suspend')
  async suspendSubscription(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.subscriptionService.suspendSubscription(id, reason);
  }

  @Post(':id/reactivate')
  async reactivateSubscription(@Param('id') id: string) {
    return this.subscriptionService.reactivateSubscription(id);
  }
}
