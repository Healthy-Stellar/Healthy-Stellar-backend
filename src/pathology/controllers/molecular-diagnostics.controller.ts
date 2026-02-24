import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MolecularDiagnosticsService } from '../services/molecular-diagnostics.service';
import {
  CreateMolecularTestDto,
  UpdateMolecularTestResultDto,
} from '../dto/create-molecular-test.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/molecular')
@UseGuards(JwtAuthGuard)
export class MolecularDiagnosticsController {
  constructor(private readonly molecularService: MolecularDiagnosticsService) {}

  @Post('tests')
  createTest(@Body() createDto: CreateMolecularTestDto, @Request() req) {
    return this.molecularService.create(createDto, req.user.userId);
  }

  @Get('tests/:id')
  findTest(@Param('id') id: string) {
    return this.molecularService.findOne(id);
  }

  @Get('case/:caseId/tests')
  findTestsByCase(@Param('caseId') caseId: string) {
    return this.molecularService.findByCase(caseId);
  }

  @Patch('tests/:id/result')
  updateResult(
    @Param('id') id: string,
    @Body() resultDto: UpdateMolecularTestResultDto,
    @Request() req,
  ) {
    return this.molecularService.updateResult(id, resultDto, req.user.userId);
  }

  @Patch('tests/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Request() req) {
    return this.molecularService.updateStatus(id, body.status as any, req.user.userId);
  }
}
