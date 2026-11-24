import {
  Controller, Post, Get, Param, Query, UploadedFile,
  UseInterceptors, UseGuards, Res, BadRequestException,
  ParseIntPipe, DefaultValuePipe, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../common/constants/swagger.constants';
import { Response } from 'express';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user?: {
    sub?: string;
    userId?: string;
    tenantId?: string;
  };
}

@ApiTags('admin/import')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  private getTenantId(req: AuthenticatedRequest): string {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Missing tenant context');
    }
    return tenantId;
  }

  private getUserId(req: AuthenticatedRequest): string | undefined {
    return req.user?.sub ?? req.user?.userId;
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload HL7, CCD, or CSV file to start import' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importService.enqueue(
      file.buffer,
      file.originalname,
      dryRun === 'true',
      this.getTenantId(req),
      this.getUserId(req),
    );
  }

  @Get(':jobId/status')
  @ApiOperation({ summary: 'Get import job progress' })
  getStatus(@Param('jobId') jobId: string, @Req() req: AuthenticatedRequest) {
    return this.importService.getStatus(jobId, this.getTenantId(req));
  }

  @Get(':jobId/errors/export')
  @ApiOperation({ summary: 'Download failed rows as CSV' })
  async exportErrors(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.importService.exportErrors(jobId, this.getTenantId(req));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import-errors-${jobId}.csv"`);
    res.send(csv);
  }

  @Get(':jobId/errors')
  @ApiOperation({ summary: 'Get paginated list of failed records for an import job' })
  getErrors(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.importService.getErrors(jobId, this.getTenantId(req), page, limit);
  }

  @Post(':jobId/reprocess')
  @ApiOperation({ summary: 'Retry only failed records from a previous import job' })
  reprocess(@Param('jobId') jobId: string, @Req() req: AuthenticatedRequest) {
    return this.importService.reprocess(jobId, this.getTenantId(req));
  }
}
