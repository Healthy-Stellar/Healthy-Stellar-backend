import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { GeneticTestingService } from '../services/genetic-testing.service';
import { CreateGeneticTestDto, UpdateGeneticTestResultDto } from '../dto/create-genetic-test.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/genetic')
@UseGuards(JwtAuthGuard)
export class GeneticTestingController {
  constructor(private readonly geneticService: GeneticTestingService) {}

  @Post('tests')
  createTest(@Body() createDto: CreateGeneticTestDto, @Request() req) {
    return this.geneticService.create(createDto, req.user.userId);
  }

  @Get('tests/:id')
  findTest(@Param('id') id: string) {
    return this.geneticService.findOne(id);
  }

  @Get('case/:caseId/tests')
  findTestsByCase(@Param('caseId') caseId: string) {
    return this.geneticService.findByCase(caseId);
  }

  @Patch('tests/:id/result')
  updateResult(
    @Param('id') id: string,
    @Body() resultDto: UpdateGeneticTestResultDto,
    @Request() req,
  ) {
    return this.geneticService.updateResult(id, resultDto, req.user.userId);
  }
}
