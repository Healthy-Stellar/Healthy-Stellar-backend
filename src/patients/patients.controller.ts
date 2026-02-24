import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';

// Guards (assumed to exist in the project)
import { PatientPrivacyGuard } from './guards/patient-privacy.guard';
import { AdminGuard } from './guards/admin-guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /**
   * -----------------------------
   * Patient Registration
   * -----------------------------
   * - Generates secure MRN
   * - Checks duplicates
   * - Stores demographics
   */
  @Post()
  async createPatient(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }
  /**
   * -----------------------------
   * Get Patient by ID
   * -----------------------------
   * - Restricted access
   * - Privacy enforced via guard
   */
  @Get(':id')
  @UseGuards(PatientPrivacyGuard)
  async getPatientById(@Param('id') id: string) {
    return this.patientsService.findById(id);
  }

  /**
   * -----------------------------
   * Get Patient by ID
   * -----------------------------
   * - Restricted access
   * - Privacy enforced via guard
   */
  @Get('/admin/all/')
  @UseGuards(AdminGuard)
  async getPatient() {
    return this.patientsService.findAll();
  }

  /**
   * -----------------------------
   * Patient Search (Privacy Controlled)
   * -----------------------------
   * - Limited fields
   * - Role-based access
   * - Prevents unauthorized patient lookup
   */
  @UseGuards(AdminGuard)
  @Get()
  search(@Query('query') q: string) {
    return this.patientsService.search(q);
  }

  /**
   * -----------------------------
   * Patient Admission
   * -----------------------------
   * - Links patient to encounter/admission
   * - ONLY ADMIN CAN ADMIT A Patient
   */
  @Post(':id/admit')
  @UseGuards(AdminGuard)
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
          const filename = `patient-${req.params.id}-${Date.now()}${ext}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(new BadRequestException('Only JPG and PNG images are allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
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
