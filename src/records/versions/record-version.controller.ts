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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecordVersionService } from './record-version.service';
import { AmendRecordDto } from './dto/amend-record.dto';

// Replace with your project's actual auth guard and user decorator
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('records/:id')
// @UseGuards(JwtAuthGuard)
export class RecordVersionController {
  constructor(private readonly versionService: RecordVersionService) {}

  @Post('amend')
  @UseInterceptors(FileInterceptor('file'))
  amend(
    @Param('id') recordId: string,
    @Body() dto: AmendRecordDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? 'stub-user';
    const encryptedDek = dto.encryptedDek ?? '';
    return this.versionService.amend(recordId, dto, file, userId, encryptedDek);
  }

  @Get('versions')
  getVersionHistory(
    @Param('id') recordId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? 'stub-user';
    return this.versionService.getVersionHistory(recordId, userId, page, limit);
  }

  @Get('versions/:version')
  getSpecificVersion(
    @Param('id') recordId: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? 'stub-user';
    return this.versionService.getSpecificVersion(recordId, version, userId);
  }

  @Get()
  getRecord(
    @Param('id') recordId: string,
    @Query('version') versionParam: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? 'stub-user';
    const version = versionParam ? parseInt(versionParam, 10) : undefined;
    return this.versionService.getLatestOrVersion(recordId, userId, version);
  }
}
