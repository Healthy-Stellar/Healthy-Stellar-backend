import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PathologyQualityService } from '../services/pathology-quality.service';
import { CreateQualityControlDto } from '../dto/create-quality-control.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/quality')
@UseGuards(JwtAuthGuard)
export class QualityControlController {
  constructor(private readonly qualityService: PathologyQualityService) {}

  @Post('review')
  createReview(@Body() createDto: CreateQualityControlDto, @Request() req) {
    return this.qualityService.create(createDto, req.user.userId);
  }

  @Get('review/:id')
  findReview(@Param('id') id: string) {
    return this.qualityService.findOne(id);
  }

  @Get('case/:caseId/reviews')
  findReviewsByCase(@Param('caseId') caseId: string) {
    return this.qualityService.findByCase(caseId);
  }

  @Patch('review/:id/resolve')
  resolveDiscrepancy(
    @Param('id') id: string,
    @Body() body: { resolutionNotes: string },
    @Request() req,
  ) {
    return this.qualityService.resolveDiscrepancy(id, body.resolutionNotes, req.user.userId);
  }

  @Get('metrics')
  getMetrics(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.qualityService.getQAMetrics(new Date(startDate), new Date(endDate));
  }
}
