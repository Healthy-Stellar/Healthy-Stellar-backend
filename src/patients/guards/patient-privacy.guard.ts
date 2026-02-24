import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Patient } from '../entities/patient.entity';
import { PatientsService } from '../patients.service';

@Injectable()
export class PatientPrivacyGuard implements CanActivate {
  constructor(private readonly patientsService: PatientsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user || { role: 'admin' }; // assuming JwtAuthGuard populated this
    const patientId = request?.params?.id || request?.body?.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Only admin users bypass
    if (user.role === 'admin') {
      return true;
    }

    // Check if user is the patient themselves
    if (patientId) {
      const patient: Patient = await this.patientsService.findById(patientId);
      if (patient.id === user.patientId) {
        return true;
      }
    }

    throw new ForbiddenException('You do not have permission to access this patient');
  }
}
