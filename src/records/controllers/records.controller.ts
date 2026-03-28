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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { RecordsService } from '../services/records.service';
import { RecordDownloadService } from '../services/record-download.service';
import { RecordAttachmentUploadService } from '../services/record-attachment-upload.service';
import { RelatedRecordsService } from '../services/related-records.service';
import { RecordVersionService } from '../services/record-version.service';
import { RecordDiffService } from '../services/record-diff.service';
import { CreateRecordDto } from '../dto/create-record.dto';
import { CreateAttachmentDto } from '../dto/create-attachment.dto';
import { AmendRecordDto } from '../dto/amend-record.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedRecordsResponseDto } from '../dto/paginated-response.dto';
import { RecentRecordDto } from '../dto/recent-record.dto';
import { RelatedRecordDto } from '../dto/related-record.dto';
import { SearchRecordsDto } from '../dto/search-records.dto';
import { SearchRecordsResponseDto } from '../dto/search-records-response.dto';
import {
  AmendRecordResponseDto,
  PaginatedVersionsResponseDto,
  RecordVersionMetaDto,
} from '../dto/record-version-response.dto';
import { RecordDiffResponseDto } from '../dto/record-diff.dto';
import { MedicalRoles } from '../../roles/medical-rbac.decorator';
import { MedicalRole } from '../../roles/medical-roles.enum';
import { MedicalRbacGuard } from '../../roles/medical-rbac.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { JwtPayload } from '../../auth/services/auth-token.service';
import { RecordResponseDto } from '../dto/record-response.dto';
import { RecordAccessGuard } from '../guards/record-access.guard';

@ApiTags('Records')
@Version('1')
@Controller('records')
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
    private readonly recordDownloadService: RecordDownloadService,
    private readonly recordAttachmentUploadService: RecordAttachmentUploadService,
    private readonly relatedRecordsService: RelatedRecordsService,
    private readonly recordVersionService: RecordVersionService,
    private readonly recordDiffService: RecordDiffService,
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
  async uploadRecord(@Body() dto: CreateRecordDto, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Encrypted record file is required');
    }

    const providerId = req.user?.userId || req.user?.id;
    return this.recordsService.uploadRecord(dto, file.buffer, providerId);
  }

  @Get()
  @DeprecatedRoute({
    sunsetDate: 'Wed, 01 Jan 2026 00:00:00 GMT',
    alternativeRoute: '/v1/records/search',
    reason: 'Use GET /v1/records/search for richer filtering. This endpoint will be removed in v2.',
  })
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
    name: 'pageSize',
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

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search records with dynamic filtering',
    description:
      'Admin/Physician can search all records. Patients are automatically scoped to their own records. ' +
      'Raw IPFS CIDs are only returned to the record owner.',
  })
  @ApiResponse({ status: 200, description: 'Search results', type: SearchRecordsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async searchRecords(
    @Query() dto: SearchRecordsDto,
    @Req() req: any,
  ): Promise<SearchRecordsResponseDto> {
    const callerId: string = req.user?.userId ?? req.user?.id;
    const callerRole: string = req.user?.role ?? '';
    return this.recordsService.search(dto, callerId, callerRole);
  }

  @Get(':id/qr-code')
  @ApiOperation({ summary: 'Generate a QR code for a one-time share link (patient only)' })
  @ApiResponse({ status: 200, description: 'Base64 PNG QR code' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async getQrCode(@Param('id') id: string, @Req() req: any) {
    const patientId = req.user?.userId || req.user?.id;
    const qrBase64 = await this.recordsService.generateQrCode(id, patientId);
    return { qrCode: qrBase64 };
  }

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

  // ── Versioning endpoints ────────────────────────────────────────────────────

  @Post(':id/amend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Amend a record — upload a new version',
    description:
      'Creates a new immutable version of the record. ' +
      'Only the record owner may amend. Requires a file upload and a reason (min 20 chars). ' +
      'Anchors the new CID on Stellar and notifies all active grantees.',
  })
  @ApiResponse({ status: 201, description: 'Amendment recorded', type: AmendRecordResponseDto })
  @ApiResponse({ status: 400, description: 'Missing file or invalid amendmentReason' })
  @ApiResponse({ status: 403, description: 'Not the record owner' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async amendRecord(
    @Param('id') id: string,
    @Body() dto: AmendRecordDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ): Promise<AmendRecordResponseDto> {
    if (!file) {
      throw new BadRequestException('Encrypted record file is required');
    }
    const requesterId: string = req.user?.userId ?? req.user?.id;
    return this.recordVersionService.amend(id, dto, file.buffer, requesterId);
  }

  @Get(':id/versions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all versions of a record (metadata only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Version list', type: PaginatedVersionsResponseDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async getVersions(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Req() req: any,
  ): Promise<PaginatedVersionsResponseDto> {
    const requesterId: string = req.user?.userId ?? req.user?.id;
    return this.recordVersionService.getVersions(
      id,
      requesterId,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );
  }

  @Get(':id/versions/:version')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve a specific historical version of a record' })
  @ApiResponse({ status: 200, description: 'Version metadata', type: RecordVersionMetaDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Record or version not found' })
  async getVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: any,
  ): Promise<RecordVersionMetaDto> {
    const requesterId: string = req.user?.userId ?? req.user?.id;
    return this.recordVersionService.getVersion(id, version, requesterId);
  }

  @Get(':id/diff')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Compare two versions of a record',
    description:
      'Returns a structured diff of record metadata between two versions. ' +
      'Binary content is not diffed — only binaryContentChanged is flagged. ' +
      'Results are cached in Redis for 10 minutes.',
  })
  @ApiQuery({ name: 'from', required: true, type: Number, description: 'Source version number' })
  @ApiQuery({ name: 'to', required: true, type: Number, description: 'Target version number' })
  @ApiResponse({ status: 200, description: 'Diff result', type: RecordDiffResponseDto })
  @ApiResponse({ status: 400, description: 'Missing or invalid from/to params' })
  @ApiResponse({ status: 403, description: 'Access denied to one or both versions' })
  @ApiResponse({ status: 404, description: 'Record or version not found' })
  async getDiff(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ): Promise<RecordDiffResponseDto> {
    if (!from || !to) {
      throw new BadRequestException('Query params "from" and "to" are required');
    }
    const fromV = parseInt(from, 10);
    const toV = parseInt(to, 10);
    if (isNaN(fromV) || isNaN(toV) || fromV < 1 || toV < 1) {
      throw new BadRequestException('"from" and "to" must be positive integers');
    }
    const requesterId: string = req.user?.userId ?? req.user?.id;
    return this.recordDiffService.computeDiff(id, fromV, toV, requesterId);
  }

  // ── Existing endpoints ──────────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(JwtAuthGuard, RecordAccessGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single record by ID' })
  @ApiResponse({
    status: 200,
    description: 'Record retrieved successfully',
    type: RecordResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async findOne(@Param('id') id: string, @Req() req: any): Promise<RecordResponseDto> {
    const user = req.user as JwtPayload;
    return this.recordsService.findOneById(id, user.userId, user.role, req.record);
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
