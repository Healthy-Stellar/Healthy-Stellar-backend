import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PatientPortalService } from '../services/patient-portal.service';
import {
  CreateCorrectionRequestDto,
  ReviewCorrectionRequestDto,
} from '../dto/create-correction-request.dto';

@ApiTags('patient-portal')
@Controller('patient-portal')
export class PatientPortalController {
  constructor(private readonly service: PatientPortalService) {}

  @Get(':patientId/correction-requests')
  @ApiOperation({ summary: 'Patient: view own correction requests' })
  getOwnCorrectionRequests(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.service.getOwnCorrectionRequests(patientId);
  }

  @Post(':patientId/correction-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Patient: submit a correction request for a specific record field' })
  submitCorrectionRequest(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateCorrectionRequestDto,
  ) {
    return this.service.submitCorrectionRequest(patientId, dto);
  }

  @Get('correction-requests/pending')
  @ApiOperation({ summary: 'Provider/Admin: list all pending correction requests' })
  getPendingRequests() {
    return this.service.getPendingCorrectionRequests();
  }

  @Patch('correction-requests/:requestId/review')
  @ApiOperation({ summary: 'Provider: approve or reject a correction request' })
  reviewCorrectionRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewCorrectionRequestDto,
  ) {
    const reviewerId = 'system';
    return this.service.reviewCorrectionRequest(requestId, reviewerId, dto);
  }

  @Get('correction-requests/:requestId')
  @ApiOperation({ summary: 'Get a single correction request by ID' })
  getCorrectionRequest(@Param('requestId', ParseUUIDPipe) requestId: string) {
    const actorId = 'system';
    return this.service.getCorrectionRequestById(requestId, actorId, 'provider');
  }
}
