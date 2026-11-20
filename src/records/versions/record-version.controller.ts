import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { API_BEARER_AUTH_SCHEME } from '../../common/constants/swagger.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RecordVersionService } from '../services/record-version.service';
import { AmendRecordDto } from '../dto/amend-record.dto';
import {
  AmendRecordResponseDto,
  PaginatedVersionsResponseDto,
  RecordVersionMetaDto,
} from '../dto/record-version-response.dto';

/**
 * Version-neutral routes for record versioning (`/records/:id/...`).
 *
 * The `/v1/records/:id/...` equivalents live on RecordsController; both
 * delegate to the single RecordVersionService.
 */
@ApiTags('Record Versions')
@ApiBearerAuth(API_BEARER_AUTH_SCHEME)
@UseGuards(JwtAuthGuard)
@Controller('records/:id')
export class RecordVersionController {
  constructor(private readonly versionService: RecordVersionService) {}

  @Post('amend')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  amend(
    @Param('id') recordId: string,
    @Body() dto: AmendRecordDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ): Promise<AmendRecordResponseDto> {
    if (!file) {
      throw new BadRequestException('Encrypted record file is required');
    }
    return this.versionService.amend(recordId, dto, file.buffer, this.requesterId(req));
  }

  @Get('versions')
  getVersionHistory(
    @Param('id') recordId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req: any,
  ): Promise<PaginatedVersionsResponseDto> {
    return this.versionService.getVersions(recordId, this.requesterId(req), page, limit);
  }

  @Get('versions/:version')
  getSpecificVersion(
    @Param('id') recordId: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: any,
  ): Promise<RecordVersionMetaDto> {
    return this.versionService.getVersion(recordId, version, this.requesterId(req));
  }

  @Get()
  getRecord(
    @Param('id') recordId: string,
    @Query('version') versionParam: string,
    @Req() req: any,
  ): Promise<RecordVersionMetaDto> {
    const requesterId = this.requesterId(req);
    if (versionParam === undefined || versionParam === '') {
      return this.versionService.getLatestVersion(recordId, requesterId);
    }
    const version = Number(versionParam);
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException('version must be a positive integer');
    }
    return this.versionService.getVersion(recordId, version, requesterId);
  }

  private requesterId(req: any): string {
    const userId: string | undefined = req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user identity could not be resolved');
    }
    return userId;
  }
}
