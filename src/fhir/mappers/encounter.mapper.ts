import { Injectable } from '@nestjs/common';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class EncounterMapper {
  toFhir(appt: Appointment): fhir4.Encounter {
    const errors = [];

    if (!appt.id) errors.push({ field: 'id', message: 'Appointment ID is required' });
    if (!appt.patientId) errors.push({ field: 'patientId', message: 'Patient ID is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Encounter', errors);
    }

    const durationMinutes = appt.duration || 30;
    const start = appt.appointmentDate ? new Date(appt.appointmentDate) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    return {
      resourceType: 'Encounter',
      id: appt.id,
      status: appt.status === 'completed' ? 'finished' : appt.status === 'cancelled' ? 'cancelled' : 'planned',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: appt.isTelemedicine ? 'VR' : 'AMB',
        display: appt.isTelemedicine ? 'virtual' : 'ambulatory',
      },
      subject: {
        reference: `Patient/${appt.patientId}`,
      },
      participant: appt.doctorId
        ? [
            {
              individual: {
                reference: `Practitioner/${appt.doctorId}`,
              },
            },
          ]
        : undefined,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      reasonCode: appt.reason
        ? [
            {
              text: appt.reason,
            },
          ]
        : undefined,
    };
  }

  fromFhir(encounter: fhir4.Encounter): Partial<Appointment> {
    const errors = [];

    if (!encounter.id) errors.push({ field: 'id', message: 'Encounter ID is required' });
    if (!encounter.subject?.reference) errors.push({ field: 'subject', message: 'Subject reference is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Encounter', errors);
    }

    const patientId = encounter.subject.reference.replace('Patient/', '');
    const doctorId = encounter.participant?.[0]?.individual?.reference?.replace('Practitioner/', '') || '';
    const start = encounter.period?.start ? new Date(encounter.period.start) : new Date();
    const end = encounter.period?.end ? new Date(encounter.period.end) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / (60 * 1000));

    return {
      id: encounter.id,
      status: encounter.status === 'finished' ? 'completed' : encounter.status === 'cancelled' ? 'cancelled' : 'scheduled',
      isTelemedicine: encounter.class?.code === 'VR',
      patientId,
      doctorId,
      appointmentDate: start,
      duration: duration > 0 ? duration : 30,
      reason: encounter.reasonCode?.[0]?.text || '',
    } as any;
  }
}
