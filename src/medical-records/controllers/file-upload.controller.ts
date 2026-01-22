import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileUploadService } from '../services/file-upload.service';
import { AttachmentType } from '../entities/medical-attachment.entity';
import { Response } from 'express';

@ApiTags('File Attachments')
@Controller('attachments')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a medical file attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        recordId: {
          type: 'string',
        },
        attachmentType: {
          type: 'string',
          enum: Object.values(AttachmentType),
        },
        description: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('recordId') recordId: string,
    @Query('attachmentType') attachmentType: AttachmentType,
    @Query('description') description: string | undefined,
    @Req() req: any = { user: null },
  ) {
    const uploadedBy = req.user?.id || 'system';
    return this.fileUploadService.uploadFile(
      file,
      recordId,
      attachmentType,
      description,
      uploadedBy,
    );
  }

  @Get('record/:recordId')
  @ApiOperation({ summary: 'Get all attachments for a medical record' })
  @ApiResponse({ status: 200, description: 'Attachments retrieved successfully' })
  async getByRecord(@Param('recordId') recordId: string) {
    return this.fileUploadService.findByRecord(recordId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an attachment by ID' })
  @ApiResponse({ status: 200, description: 'Attachment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async findOne(@Param('id') id: string) {
    return this.fileUploadService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download an attachment file' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { stream, attachment } = await this.fileUploadService.getFileStream(id);
    
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.originalFileName}"`,
    );
    
    stream.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiResponse({ status: 200, description: 'Attachment deleted successfully' })
  async delete(@Param('id') id: string) {
    await this.fileUploadService.delete(id);
  }
}
