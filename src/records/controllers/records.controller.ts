import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { RecordsService } from '../services/records.service';
import { RecordDownloadService } from '../services/record-download.service';
import { RelatedRecordsService } from '../services/related-records.service';
import { CreateRecordDto } from '../dto/create-record.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedRecordsResponseDto } from '../dto/paginated-response.dto';
import { RecentRecordDto } from '../dto/recent-record.dto';
import { RelatedRecordDto } from '../dto/related-record.dto';
import { MedicalRoles } from '../../roles/medical-rbac.decorator';
import { MedicalRole } from '../../roles/medical-roles.enum';
import { MedicalRbacGuard } from '../../roles/medical-rbac.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Records')
@Controller('records')
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
    private readonly recordDownloadService: RecordDownloadService,
    private readonly relatedRecordsService: RelatedRecordsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Upload a new medical record' })
  @ApiResponse({ status: 201, description: 'Record uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadRecord(@Body() dto: CreateRecordDto, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Encrypted record file is required');
    }

    return this.recordsService.uploadRecord(dto, file.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'List all medical records with pagination, filtering, and sorting' })
  @ApiResponse({
    status: 200,
    description: 'Records retrieved successfully',
    type: PaginatedRecordsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query parameters' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'recordType',
    required: false,
    enum: ['MEDICAL_REPORT', 'LAB_RESULT', 'PRESCRIPTION', 'IMAGING', 'CONSULTATION'],
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({ name: 'toDate', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'recordType', 'patientId'],
    description: 'Sort field (default: createdAt)',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiQuery({
    name: 'patientId',
    required: false,
    type: String,
    description: 'Filter by patient ID',
  })
  async findAll(@Query() query: PaginationQueryDto): Promise<PaginatedRecordsResponseDto> {
    return this.recordsService.findAll(query);
  }

  @Get(':id/qr-code')
  @ApiOperation({ summary: 'Generate a QR code for a one-time share link (patient only)' })
  @ApiResponse({ status: 200, description: 'Base64 PNG QR code' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async getQrCode(@Param('id') id: string, @Req() req: any) {
    const patientId = req.user?.userId || req.user?.id;
    const qrBase64 = await this.recordsService.generateQrCode(id, patientId);
    return { qrCode: qrBase64 };
  @Get('recent')
  @ApiBearerAuth()
  @UseGuards(MedicalRbacGuard)
  @MedicalRoles(MedicalRole.ADMIN)
  @ApiOperation({ summary: 'Get latest platform activity (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Recent records retrieved successfully',
    type: [RecentRecordDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getRecent(): Promise<RecentRecordDto[]> {
    return this.recordsService.findRecent();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single record by ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const requesterId = req.user?.userId || req.user?.id;
    return this.recordsService.findOne(id, requesterId);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download and decrypt a record file' })
  @ApiResponse({ status: 200, description: 'Decrypted file streamed to client' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'No active access grant' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async downloadRecord(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const requesterId: string = req.user?.userId ?? req.user?.id;
    const ip: string = req.ip ?? 'unknown';
    const ua: string = req.headers['user-agent'] ?? 'unknown';

    const { stream, contentType, filename } = await this.recordDownloadService.download(
      id,
      requesterId,
      ip,
      ua,
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    stream.pipe(res);
  @Get(':id/related')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get related records',
    description:
      'Returns up to 10 records related to the given record, scored by: ' +
      'same type (3pts), same provider (2pts), within ±30 days (1pt). ' +
      'Access control is enforced on every returned record.',
  })
  @ApiResponse({ status: 200, description: 'Related records returned', type: [RelatedRecordDto] })
  @ApiResponse({ status: 403, description: 'Access denied to source record' })
  @ApiResponse({ status: 404, description: 'Source record not found' })
  async getRelated(@Param('id') id: string, @Req() req: any): Promise<RelatedRecordDto[]> {
    const requesterId = req.user?.userId || req.user?.id;
    return this.relatedRecordsService.findRelated(id, requesterId);
  }

  @Get(':id/events')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get raw event stream for a record (admin only)',
    description:
      'Returns the full immutable event log for a record in sequence order. ' +
      'Each event represents a state change. Current state is derived by replaying these events.',
  })
  @ApiResponse({ status: 200, description: 'Event stream returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'No events found for this record' })
  async getEventStream(@Param('id') id: string) {
    return this.recordsService.getEventStream(id);
  }

  @Get(':id/state')
  @ApiOperation({
    summary: 'Get current record state derived from event replay',
    description: 'Replays the event stream (using snapshot optimisation) to return current state.',
  })
  @ApiResponse({ status: 200, description: 'State derived successfully' })
  @ApiResponse({ status: 404, description: 'Record not found in event store' })
  async getStateFromEvents(@Param('id') id: string) {
    return this.recordsService.getStateFromEvents(id);
  }
}
