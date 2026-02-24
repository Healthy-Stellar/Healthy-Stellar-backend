import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DigitalPathologyService } from '../services/digital-pathology.service';
import { UploadDigitalImageDto } from '../dto/upload-digital-image.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/images')
@UseGuards(JwtAuthGuard)
export class DigitalPathologyController {
  constructor(private readonly imageService: DigitalPathologyService) {}

  @Post('upload')
  uploadImage(@Body() uploadDto: UploadDigitalImageDto, @Request() req) {
    return this.imageService.uploadImage(uploadDto, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.imageService.findOne(id, req.user.userId);
  }

  @Get('case/:caseId')
  findByCase(@Param('caseId') caseId: string) {
    return this.imageService.findByCase(caseId);
  }

  @Get('slide/:slideId')
  findBySlide(@Param('slideId') slideId: string, @Query('type') type: 'histology' | 'cytology') {
    return this.imageService.findBySlide(slideId, type);
  }

  @Post(':id/annotate')
  addAnnotation(
    @Param('id') id: string,
    @Body() body: { annotations: Record<string, any> },
    @Request() req,
  ) {
    return this.imageService.addAnnotation(id, body.annotations, req.user.userId);
  }

  @Post(':id/ai-analysis')
  addAIAnalysis(
    @Param('id') id: string,
    @Body() body: { analysisResults: Record<string, any> },
    @Request() req,
  ) {
    return this.imageService.addAIAnalysis(id, body.analysisResults, req.user.userId);
  }
}
