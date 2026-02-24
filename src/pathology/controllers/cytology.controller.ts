import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CytologyService } from '../services/cytology.service';
import { CreateCytologySlideDto } from '../dto/create-cytology-slide.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/cytology')
@UseGuards(JwtAuthGuard)
export class CytologyController {
  constructor(private readonly cytologyService: CytologyService) {}

  @Post('slides')
  createSlide(@Body() createDto: CreateCytologySlideDto, @Request() req) {
    return this.cytologyService.create(createDto, req.user.userId);
  }

  @Get('slides/:id')
  findSlide(@Param('id') id: string) {
    return this.cytologyService.findOne(id);
  }

  @Get('case/:caseId/slides')
  findSlidesByCase(@Param('caseId') caseId: string) {
    return this.cytologyService.findByCase(caseId);
  }

  @Post('slides/:id/screen')
  screenSlide(
    @Param('id') id: string,
    @Body() body: { cytotechId: string; cytotechName: string; findings: string },
    @Request() req,
  ) {
    return this.cytologyService.screenSlide(
      id,
      body.cytotechId,
      body.cytotechName,
      body.findings,
      req.user.userId,
    );
  }

  @Post('slides/:id/review')
  pathologistReview(
    @Param('id') id: string,
    @Body()
    body: {
      pathologistId: string;
      pathologistName: string;
      interpretation: string;
      recommendation: string;
    },
    @Request() req,
  ) {
    return this.cytologyService.pathologistReview(
      id,
      body.pathologistId,
      body.pathologistName,
      body.interpretation,
      body.recommendation,
      req.user.userId,
    );
  }
}
