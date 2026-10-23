// Every call the sandbox makes, with the IHE transaction it implements and the ELGA transaction
// it stands in for. Mappings: IHE MHD 4.2.5 cross-profile considerations, PDQm 3.2.0, and the
// ELGA overall architecture 2.30a (Abbildung 9). See docs/research/phase-1-research.md, 1.3 and 1.4.

export type TransactionId = 'ITI-78' | 'ITI-67' | 'ITI-68' | 'ITI-65' | 'ITI-20' | 'ITI-81' | 'contact' | 'access' | 'clock';

export interface Transaction {
  id: TransactionId;
  /** Short label shown in the log, e.g. "ITI-67". */
  code: string;
  name: string;
  /** What it does, in one or two plain sentences (tooltip). */
  explain: string;
  /** The ELGA transaction this stands in for. Undefined for sandbox-only steps. */
  elga?: string;
  /** True when the step is a simplification of a more complex ELGA flow. */
  simplified?: boolean;
  source?: string;
}

export const TRANSACTIONS: Record<TransactionId, Transaction> = {
  'ITI-78': {
    id: 'ITI-78',
    code: 'ITI-78',
    name: 'Mobile Patient Demographics Query',
    explain: 'Finds a patient by name, date of birth or number. IHE PDQm, a FHIR search on Patient.',
    elga: 'ITI-47 Patient Demographics Query (HL7 V3) against the central patient index',
    source: 'https://profiles.ihe.net/ITI/PDQm/volume-1.html',
  },
  'ITI-67': {
    id: 'ITI-67',
    code: 'ITI-67',
    name: 'Find Document References',
    explain: "Lists the documents registered for a patient, without their content. IHE MHD, a FHIR search on DocumentReference.",
    elga: 'ITI-18 Registry Stored Query (ITI-38 Cross Gateway Query between ELGA areas)',
    source: 'https://profiles.ihe.net/ITI/MHD/1336_cross_profile_considerations.html',
  },
  'ITI-68': {
    id: 'ITI-68',
    code: 'ITI-68',
    name: 'Retrieve Document',
    explain: 'Fetches the content of one document. IHE MHD, a FHIR read on the Binary the DocumentReference points to.',
    elga: 'ITI-43 Retrieve Document Set (ITI-39 Cross Gateway Retrieve between ELGA areas)',
    source: 'https://profiles.ihe.net/ITI/MHD/1336_cross_profile_considerations.html',
  },
  'ITI-65': {
    id: 'ITI-65',
    code: 'ITI-65',
    name: 'Provide Document Bundle',
    explain: 'Stores a document and registers it in one step. IHE MHD, a FHIR transaction Bundle.',
    elga: 'ITI-41 Provide and Register Document Set-b',
    source: 'https://profiles.ihe.net/ITI/MHD/1336_cross_profile_considerations.html',
  },
  'ITI-20': {
    id: 'ITI-20',
    code: 'ITI-20',
    name: 'Record Audit Event',
    explain: 'Writes one entry to the audit log: who accessed what, when, and whether it was allowed. Sent as a FHIR AuditEvent (ATNA FHIR Feed).',
    elga: "ITI-20 Record Audit Event (syslog) to the ELGA area's audit record repository",
    source: 'https://profiles.ihe.net/ITI/BALP/volume-1.html',
  },
  'ITI-81': {
    id: 'ITI-81',
    code: 'ITI-81',
    name: 'Retrieve ATNA Audit Event',
    explain: "Reads the audit log back: a FHIR search on AuditEvent for one patient.",
    elga: 'Patients read their access log in the access portal, collected from the areas into an aggregated audit repository',
    source: 'https://profiles.ihe.net/ITI/BALP/volume-1.html',
  },
  contact: {
    id: 'contact',
    code: 'Contact',
    name: 'Record contact confirmation',
    explain: 'Records that the patient was in contact with this provider, as inserting the e-card would.',
    elga: 'The e-card system signs the contact; the practice software forwards it to the contact confirmation service over WS-Trust',
    simplified: true,
  },
  access: {
    id: 'access',
    code: 'Access check',
    name: 'Contact confirmation and patient settings',
    explain: "Checks the provider's contact confirmation, the time window and the patient's settings before any record is touched.",
    elga: 'The ELGA token service issues a SAML assertion, sent with XUA ITI-40 and enforced by the access control facade',
    simplified: true,
  },
  clock: {
    id: 'clock',
    code: 'Clock',
    name: 'Move simulated time',
    explain: 'Moves the sandbox clock so you can watch access windows end. There is no ELGA equivalent.',
  },
};
