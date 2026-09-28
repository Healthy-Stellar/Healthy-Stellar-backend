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
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PatientPortalService } from '../services/patient-portal.service';
import {
  CreateCorrectionRequestDto,
  ReviewCorrectionRequestDto,
} from '../dto/create-correction-request.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    role: string;
    patientId?: string;
  };
}

@ApiTags('patient-portal')
@Controller('patient-portal')
@UseGuards(JwtAuthGuard)
export class PatientPortalController {
  constructor(private readonly service: PatientPortalService) {}

  @Get(':patientId/correction-requests')
  @ApiOperation({ summary: 'Patient: view own correction requests' })
  getOwnCorrectionRequests(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnership(req.user, patientId);
    return this.service.getOwnCorrectionRequests(patientId);
  }

  @Post(':patientId/correction-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Patient: submit a correction request for a specific record field' })
  submitCorrectionRequest(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateCorrectionRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnership(req.user, patientId);
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
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reviewCorrectionRequest(requestId, req.user.id, dto);
  }

  @Get('correction-requests/:requestId')
  @ApiOperation({ summary: 'Get a single correction request by ID' })
  getCorrectionRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getCorrectionRequestById(requestId, req.user.id, req.user.role);
  }

  private assertOwnership(user: AuthenticatedRequest['user'], patientId: string): void {
    if (user.role !== 'patient') {
      return;
    }
    if (user.patientId !== patientId && user.id !== patientId) {
      throw new ForbiddenException('You may only access your own correction requests');
    }
  }
}
