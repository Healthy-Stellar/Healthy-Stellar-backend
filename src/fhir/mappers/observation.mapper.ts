import { Injectable } from '@nestjs/common';
import { LabResult } from '../../laboratory/entities/lab-result.entity';
import { FhirMappingException } from '../exceptions/fhir-mapping.exception';

@Injectable()
export class ObservationMapper {
  toFhir(result: LabResult): fhir4.Observation {
    const errors = [];

    if (!result.id) errors.push({ field: 'id', message: 'LabResult ID is required' });
    if (!result.testCode) errors.push({ field: 'testCode', message: 'Test code is required' });
    if (!result.result) errors.push({ field: 'result', message: 'Result is required' });

    if (errors.length > 0) {
      throw new FhirMappingException('Observation', errors);
    }

    return {
      resourceType: 'Observation',
      id: result.id,
      status: (result.status as any) || 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: result.testCode,
            display: result.testName,
          },
        ],
        text: result.testName,
      },
      subject: {
        reference: `Patient/${(result as any).patientId || 'unknown'}`,
      },
      valueString: result.result,
      interpretation: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: result.flag === 'abnormal' || result.flag === 'critical' ? 'A' : 'N',
              display: result.flag === 'abnormal' || result.flag === 'critical' ? 'Abnormal' : 'Normal',
            },
          ],
        },
      ],
      effectiveDateTime: result.performedAt?.toISOString(),
      performer: result.performedBy
        ? [
            {
              reference: `Practitioner/${result.performedBy}`,
            },
          ]
        : undefined,
    };
  }

  fromFhir(observation: fhir4.Observation): Partial<LabResult> {
    const errors = [];

    if (!observation.id) errors.push({ field: 'id', message: 'Observation ID is required' });
    if (!observation.code?.coding?.[0]?.code) {
      errors.push({ field: 'code', message: 'Observation code is required' });
    }

    if (errors.length > 0) {
      throw new FhirMappingException('Observation', errors);
    }

    const coding = observation.code.coding[0];
    const patientId = observation.subject?.reference?.replace('Patient/', '') || 'unknown';
    const performerId = observation.performer?.[0]?.reference?.replace('Practitioner/', '') || 'unknown';

    return {
      id: observation.id,
      status: observation.status,
      testCode: coding.code,
      testName: coding.display || observation.code.text || '',
      result: observation.valueString || '',
      flag: observation.interpretation?.[0]?.coding?.[0]?.code === 'A' ? 'abnormal' : 'normal',
      performedAt: observation.effectiveDateTime ? new Date(observation.effectiveDateTime) : new Date(),
      performedBy: performerId,
      patientId,
    } as any;
  }
}
