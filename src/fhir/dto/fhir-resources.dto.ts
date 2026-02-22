export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
  };
}

export interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  identifier?: Array<{ system?: string; value: string }>;
  name?: Array<{ family: string; given: string[] }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  telecom?: Array<{ system: string; value: string }>;
  address?: Array<{ text: string }>;
}

export interface FhirDocumentReference extends FhirResource {
  resourceType: 'DocumentReference';
  status: 'current' | 'superseded' | 'entered-in-error';
  type: { coding: Array<{ system: string; code: string; display: string }> };
  subject: { reference: string };
  date?: string;
  author?: Array<{ reference: string }>;
  description?: string;
  content: Array<{ attachment: { contentType?: string; data?: string } }>;
}

export interface FhirConsent extends FhirResource {
  resourceType: 'Consent';
  status: 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';
  scope: { coding: Array<{ system: string; code: string }> };
  category: Array<{ coding: Array<{ system: string; code: string }> }>;
  patient: { reference: string };
  dateTime?: string;
  provision?: {
    type: 'deny' | 'permit';
    period?: { start?: string; end?: string };
    actor?: Array<{ reference: { reference: string } }>;
  };
}

export interface FhirProvenance extends FhirResource {
  resourceType: 'Provenance';
  target: Array<{ reference: string }>;
  recorded: string;
  agent: Array<{ who: { reference: string } }>;
  activity?: { coding: Array<{ system: string; code: string; display: string }> };
}

export interface FhirOperationOutcome extends FhirResource {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    diagnostics?: string;
  }>;
}

export interface FhirCapabilityStatement extends FhirResource {
  resourceType: 'CapabilityStatement';
  status: 'draft' | 'active' | 'retired';
  date: string;
  kind: 'instance' | 'capability' | 'requirements';
  fhirVersion: string;
  format: string[];
  rest: Array<{
    mode: 'client' | 'server';
    resource: Array<{
      type: string;
      interaction: Array<{ code: string }>;
    }>;
  }>;
}
