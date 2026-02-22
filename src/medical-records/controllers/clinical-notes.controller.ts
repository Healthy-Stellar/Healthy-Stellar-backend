import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateClinicalNoteDto,
  SearchClinicalNotesDto,
  SignClinicalNoteDto,
  UpdateClinicalNoteDto,
} from '../dto/clinical-note.dto';
import { ClinicalNotesService } from '../services/clinical-notes.service';

@ApiTags('Clinical Notes')
@Controller('clinical-notes')
export class ClinicalNotesController {
  constructor(private readonly clinicalNotesService: ClinicalNotesService) {}

  @Post()
  @ApiOperation({ summary: 'Create clinical note' })
  @ApiResponse({ status: 201, description: 'Clinical note created' })
  async create(@Body() createDto: CreateClinicalNoteDto) {
    return await this.clinicalNotesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Search clinical notes' })
  async findAll(@Query() filters: SearchClinicalNotesDto) {
    return await this.clinicalNotesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinical note by ID' })
  async findById(@Param('id') id: string) {
    return await this.clinicalNotesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update clinical note' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateClinicalNoteDto) {
    return await this.clinicalNotesService.update(id, updateDto);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign clinical note' })
  async sign(@Param('id') id: string, @Body() signDto: SignClinicalNoteDto) {
    return await this.clinicalNotesService.sign(id, signDto);
  }

  @Get(':id/completeness')
  @ApiOperation({ summary: 'Check clinical note completeness' })
  async getCompleteness(@Param('id') id: string) {
    return await this.clinicalNotesService.getCompleteness(id);
  }
}
