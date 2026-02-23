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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { RecordsService } from '../services/records.service';
import { CreateRecordDto } from '../dto/create-record.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedRecordsResponseDto } from '../dto/paginated-response.dto';

@ApiTags('Records')
@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

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
  async uploadRecord(
    @Body() dto: CreateRecordDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
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
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'recordType', required: false, enum: ['MEDICAL_REPORT', 'LAB_RESULT', 'PRESCRIPTION', 'IMAGING', 'CONSULTATION'] })
  @ApiQuery({ name: 'fromDate', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'toDate', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'recordType', 'patientId'], description: 'Sort field (default: createdAt)' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Sort order (default: desc)' })
  @ApiQuery({ name: 'patientId', required: false, type: String, description: 'Filter by patient ID' })
  async findAll(@Query() query: PaginationQueryDto): Promise<PaginatedRecordsResponseDto> {
    return this.recordsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single record by ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async findOne(@Param('id') id: string) {
    return this.recordsService.findOne(id);
  }
}
