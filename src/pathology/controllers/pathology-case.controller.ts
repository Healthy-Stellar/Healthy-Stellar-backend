import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PathologyCaseService } from '../services/pathology-case.service';
import { CreatePathologyCaseDto } from '../dto/create-pathology-case.dto';
import { UpdatePathologyCaseDto } from '../dto/update-pathology-case.dto';
import { SearchPathologyDto } from '../dto/search-pathology.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('pathology/cases')
@UseGuards(JwtAuthGuard)
export class PathologyCaseController {
  constructor(private readonly caseService: PathologyCaseService) {}

  @Post()
  create(@Body() createDto: CreatePathologyCaseDto, @Request() req) {
    return this.caseService.create(createDto, req.user.userId);
  }

  @Get()
  findAll(@Query() searchDto: SearchPathologyDto) {
    return this.caseService.findAll(searchDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.caseService.findOne(id);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.caseService.findByPatient(patientId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdatePathologyCaseDto, @Request() req) {
    return this.caseService.update(id, updateDto, req.user.userId);
  }

  @Post(':id/assign')
  assignPathologist(
    @Param('id') id: string,
    @Body() body: { pathologistId: string; pathologistName: string },
    @Request() req,
  ) {
    return this.caseService.assignPathologist(
      id,
      body.pathologistId,
      body.pathologistName,
      req.user.userId,
    );
  }

  @Post(':id/consultation')
  requestConsultation(
    @Param('id') id: string,
    @Body() body: { consultationNotes: string },
    @Request() req,
  ) {
    return this.caseService.requestConsultation(id, body.consultationNotes, req.user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.caseService.delete(id);
  }
}
