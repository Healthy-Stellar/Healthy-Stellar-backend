import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Patient } from '../entities/patient.entity';
import { PatientsService } from '../patients.service';

@Injectable()
export class PatientPrivacyGuard implements CanActivate {
  constructor(private readonly patientsService: PatientsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const patientIdentifier =
      request?.params?.id ||
      request?.params?.address ||
      request?.params?.patientId ||
      request?.body?.id ||
      request?.body?.address ||
      request?.body?.patientId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Only admin users bypass
    if (user.role === 'admin' || user.role === 'super_admin') {
      return true;
    }

    // Check if user is the patient themselves
    if (patientIdentifier) {
      const userStellar = user.stellarAddress || (user as any).stellarPublicKey;
      if (
        (user.patientId && patientIdentifier === user.patientId) ||
        (user.id && patientIdentifier === user.id) ||
        (userStellar && patientIdentifier === userStellar)
      ) {
        return true;
      }

      try {
        const patient: Patient = await this.patientsService.findById(patientIdentifier);
        if (
          (user.patientId && patient.id === user.patientId) ||
          (user.id && patient.id === user.id) ||
          (userStellar && patient.stellarAddress === userStellar) ||
          (userStellar && patient.id === userStellar) ||
          (patient.stellarAddress && (user.patientId === patient.stellarAddress || user.id === patient.stellarAddress))
        ) {
          return true;
        }
      } catch (err) {
        // Fall through to forbidden if patient not found
      }
    }

    throw new ForbiddenException('You do not have permission to access this patient');
  }
}
