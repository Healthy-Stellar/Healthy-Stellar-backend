import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { HistologyService } from '../services/histology.service';
import { CreateHistologySlideDto } from '../dto/create-histology-slide.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/histology')
@UseGuards(JwtAuthGuard)
export class HistologyController {
  constructor(private readonly histologyService: HistologyService) {}

  @Post('slides')
  createSlide(@Body() createDto: CreateHistologySlideDto, @Request() req) {
    return this.histologyService.create(createDto, req.user.userId);
  }

  @Get('slides/:id')
  findSlide(@Param('id') id: string) {
    return this.histologyService.findOne(id);
  }

  @Get('case/:caseId/slides')
  findSlidesByCase(@Param('caseId') caseId: string) {
    return this.histologyService.findByCase(caseId);
  }

  @Post('slides/:id/stain')
  performStaining(
    @Param('id') id: string,
    @Body() body: { stainType: string; technicianId: string; technicianName: string },
    @Request() req,
  ) {
    return this.histologyService.performStaining(
      id,
      body.stainType,
      body.technicianId,
      body.technicianName,
      req.user.userId,
    );
  }

  @Post('slides/:id/recut')
  requestRecut(@Param('id') id: string, @Body() body: { reason: string }, @Request() req) {
    return this.histologyService.requestRecut(id, body.reason, req.user.userId);
  }
}
