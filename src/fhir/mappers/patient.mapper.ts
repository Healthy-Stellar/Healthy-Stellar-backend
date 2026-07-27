import { Injectable } from '@nestjs/common';
import { User } from '../../auth/entities/user.entity';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class PatientMapper {
  toFhir(user: User): fhir4.Patient {
    const errors = [];

    if (!user.id) errors.push({ field: 'id', message: 'User ID is required' });
    if (!user.firstName) errors.push({ field: 'firstName', message: 'First name is required' });
    if (!user.lastName) errors.push({ field: 'lastName', message: 'Last name is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Patient', errors);
    }

    return {
      resourceType: 'Patient',
      id: user.id,
      active: user.status === 'ACTIVE',
      name: [
        {
          use: 'official',
          family: user.lastName,
          given: [user.firstName],
        },
      ],
      telecom: user.email
        ? [
            {
              system: 'email',
              value: user.email,
              use: 'home',
            },
          ]
        : undefined,
      meta: {
        lastUpdated: user.updatedAt?.toISOString(),
      },
    };
  }

  fromFhir(patient: fhir4.Patient): Partial<User> {
    const errors = [];

    if (!patient.id) errors.push({ field: 'id', message: 'Patient ID is required' });
    if (!patient.name?.[0]) errors.push({ field: 'name', message: 'Patient name is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Patient', errors);
    }

    const name = patient.name[0];
    const email = patient.telecom?.find((t) => t.system === 'email')?.value;

    return {
      id: patient.id,
      firstName: name.given?.[0] || '',
      lastName: name.family || '',
      email: email || '',
      status: patient.active ? 'ACTIVE' : 'INACTIVE',
    } as any;
  }
}
