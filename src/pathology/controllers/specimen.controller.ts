import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SpecimenProcessingService } from '../services/specimen-processing.service';
import { CreateSpecimenDto } from '../dto/create-specimen.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/specimens')
@UseGuards(JwtAuthGuard)
export class SpecimenController {
  constructor(private readonly specimenService: SpecimenProcessingService) {}

  @Post()
  create(@Body() createDto: CreateSpecimenDto, @Request() req) {
    return this.specimenService.create(createDto, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.specimenService.findOne(id);
  }

  @Get('case/:caseId')
  findByCase(@Param('caseId') caseId: string) {
    return this.specimenService.findByCase(caseId);
  }

  @Patch(':id/process')
  updateProcessing(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.specimenService.updateProcessing(id, data, req.user.userId);
  }
}
