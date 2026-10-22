import { Injectable } from '@nestjs/common';
import { MedicalProcedure } from '../../treatment-planning/entities/medical-procedure.entity';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class ProcedureMapper {
  toFhir(proc: MedicalProcedure): fhir4.Procedure {
    const errors = [];

    if (!proc.id) errors.push({ field: 'id', message: 'Procedure ID is required' });
    if (!proc.patientId) errors.push({ field: 'patientId', message: 'Patient ID is required' });
    if (!proc.procedureName) errors.push({ field: 'procedureName', message: 'Procedure name is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Procedure', errors);
    }

    return {
      resourceType: 'Procedure',
      id: proc.id,
      status: proc.status === 'completed' ? 'completed' : proc.status === 'cancelled' ? 'not-done' : 'preparation',
      code: {
        coding: [
          {
            system: 'http://www.ama-assn.org/go/cpt',
            code: proc.cptCode || 'unknown',
            display: proc.procedureName,
          },
        ],
        text: proc.procedureName,
      },
      subject: {
        reference: `Patient/${proc.patientId}`,
      },
      performedPeriod: {
        start: proc.actualStartTime?.toISOString() || proc.scheduledDate?.toISOString(),
        end: proc.actualEndTime?.toISOString() || undefined,
      },
      note: proc.preProcedureNotes || proc.postProcedureNotes
        ? [
            {
              text: `${proc.preProcedureNotes || ''} ${proc.postProcedureNotes || ''}`.trim(),
            },
          ]
        : undefined,
    };
  }

  fromFhir(proc: fhir4.Procedure): Partial<MedicalProcedure> {
    const errors = [];

    if (!proc.id) errors.push({ field: 'id', message: 'Procedure ID is required' });
    if (!proc.subject?.reference) errors.push({ field: 'subject', message: 'Subject reference is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Procedure', errors);
    }

    const patientId = proc.subject.reference.replace('Patient/', '');
    const cptCode = proc.code?.coding?.[0]?.code || '';
    const procedureName = proc.code?.coding?.[0]?.display || proc.code?.text || '';

    return {
      id: proc.id,
      status: proc.status === 'completed' ? 'completed' : 'scheduled',
      cptCode,
      procedureName,
      patientId,
      actualStartTime: proc.performedPeriod?.start ? new Date(proc.performedPeriod.start) : undefined,
      actualEndTime: proc.performedPeriod?.end ? new Date(proc.performedPeriod.end) : undefined,
    } as any;
  }
}
