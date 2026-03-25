import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientPrivacyGuard } from './guards/patient-privacy.guard';
import { AdminGuard } from './guards/admin-guard';
import { PatientOwnerGuard } from './guards/patient-owner.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SetGeoRestrictionsDto } from './dto/set-geo-restrictions.dto';
import { PatientPrivacyGuard } from './guards/patient-privacy.guard';
import { AdminGuard } from './guards/admin-guard';
import { GeoRestrictionGuard } from './guards/geo-restriction.guard';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new patient' })
  async createPatient(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Get(':id')
  @UseGuards(PatientPrivacyGuard, GeoRestrictionGuard)
  @ApiOperation({ summary: 'Get patient by ID' })
  async getPatientById(@Param('id') id: string) {
    return this.patientsService.findById(id);
  }

  @Get('/admin/all/')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all patients (admin only)' })
  async getPatient() {
    return this.patientsService.findAll();
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Search patients' })
  search(@Query('query') q: string) {
    return this.patientsService.search(q);
  }

  /**
   * PATCH /patients/:address/geo-restrictions
   * Set allowed country codes for geo-based access restriction.
   * Empty array removes all restrictions.
   */
  @Patch(':address/geo-restrictions')
  @UseGuards(PatientPrivacyGuard)
  @ApiOperation({ summary: 'Set geo-restrictions for a patient record' })
  @ApiParam({ name: 'address', description: 'Patient ID (Stellar address)' })
  @ApiResponse({ status: 200, description: 'Geo-restrictions updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async setGeoRestrictions(
    @Param('address') address: string,
    @Body() dto: SetGeoRestrictionsDto,
  ) {
    return this.patientsService.setGeoRestrictions(address, dto.allowedCountries);
  }

  @Post(':id/admit')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admit a patient (admin only)' })
  async admitPatient(@Param('id') id: string) {
    return this.patientsService.admit(id);
  }

  /**
   * -----------------------------
   * Patient Update Photo URL
   * -----------------------------
   * - ONLY ADMIN CAN ADMIT A Patient
   */

  /**
   * -----------------------------
   * Update Patient Profile (off-chain metadata)
   * -----------------------------
   * - Patient can only update their own profile
   * - stellarAddress and nationalIdHash are immutable (not in DTO)
   */
  @Patch(':address/profile')
  @UseGuards(PatientOwnerGuard)
  async updateProfile(
    @Param('address') address: string,
    @Body() dto: UpdatePatientProfileDto,
  ) {
    return this.patientsService.updateProfile(address, dto);
  }

  /**
   * -----------------------------
   * Upload Patient Photo
   * -----------------------------
   * - JPG / PNG only
   * - Max 5MB
   * - Stored locally
   */
  @Post(':id/photo')
  @UseGuards(PatientPrivacyGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/patients/photos',
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `patient-${req.params.id}-${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(new BadRequestException('Only JPG and PNG images are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload patient photo' })
  async uploadPatientPhoto(
    @Param('id') patientId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    return this.patientsService.attachPhoto(patientId, file);
  }
}
