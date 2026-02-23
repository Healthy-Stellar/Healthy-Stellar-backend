// src/notifications/notifications.controller.ts
import {
  Controller,
  Post,
  Query,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { IsString, IsNotEmpty } from 'class-validator';

export class UnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  patientId: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * POST /notifications/unsubscribe
   * Supports both query params (from email link) and request body
   *
   * Example email link:
   *   https://app.example.com/notifications/unsubscribe?token=abc&patientId=123
   */
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Query('token') tokenQuery?: string,
    @Query('patientId') patientIdQuery?: string,
    @Body() body?: UnsubscribeDto,
  ) {
    const token = tokenQuery ?? body?.token;
    const patientId = patientIdQuery ?? body?.patientId;

    if (!token || !patientId) {
      throw new BadRequestException('token and patientId are required');
    }

    return this.notificationsService.unsubscribe(patientId, token);
  }
}
