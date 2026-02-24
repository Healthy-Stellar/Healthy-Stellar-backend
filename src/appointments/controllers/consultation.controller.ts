import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConsultationService } from '../services/consultation.service';
import { CreateConsultationNoteDto } from '../dto/create-consultation-note.dto';
import { ConsultationOutcome } from '../entities/consultation-note.entity';

@ApiTags('Consultations')
@Controller('consultations')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  @Post('notes')
  @ApiOperation({ summary: 'Create consultation note with outcomes' })
  @ApiResponse({ status: 201, description: 'Consultation note created successfully' })
  createNote(@Body() createConsultationDto: CreateConsultationNoteDto) {
    return this.consultationService.create(createConsultationDto);
  }

  @Get('appointment/:appointmentId')
  @ApiOperation({ summary: 'Get consultation notes for an appointment' })
  @ApiResponse({ status: 200, description: 'List of consultation notes' })
  findByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.consultationService.findByAppointment(appointmentId);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({ summary: 'Get consultation notes by doctor' })
  @ApiResponse({ status: 200, description: 'List of consultation notes by doctor' })
  findByDoctor(@Param('doctorId') doctorId: string) {
    return this.consultationService.findByDoctor(doctorId);
  }

  @Get('outcome/:outcome')
  @ApiOperation({ summary: 'Get consultations by outcome' })
  @ApiResponse({ status: 200, description: 'List of consultations with specified outcome' })
  findByOutcome(@Param('outcome') outcome: ConsultationOutcome) {
    return this.consultationService.findByOutcome(outcome);
  }

  @Get('follow-up/required')
  @ApiOperation({ summary: 'Get consultations requiring follow-up' })
  @ApiResponse({ status: 200, description: 'List of consultations requiring follow-up' })
  getFollowUpRequired() {
    return this.consultationService.getFollowUpRequired();
  }

  @Patch('notes/:id')
  @ApiOperation({ summary: 'Update consultation note' })
  @ApiResponse({ status: 200, description: 'Consultation note updated successfully' })
  updateNote(@Param('id') id: string, @Body() updateData: any) {
    return this.consultationService.update(id, updateData);
  }
}
