// FHIR R4 resources for the synthetic world. Patients claim the HL7 Austria AT Core Patient profile
// and are validated against it; documents follow the IHE MHD shape (DocumentReference plus Binary).

import type { Binary, Bundle, BundleEntry, CodeSystem, DocumentReference, Organization, Patient, Practitioner } from 'fhir/r4';
import { LOINC_TYPE, SANDBOX_OID, buildCda } from './cda';
import { AUTHORS, DOCUMENTS, PATIENTS, PROVIDERS, recordKindOf, type SeedDocument, type SeedPatient } from './seed';
import { SYNTHETIC_SVNR_SYSTEM } from './svnr';

export const AT_CORE_PATIENT = 'http://hl7.at/fhir/HL7ATCoreProfiles/4.0.1/StructureDefinition/at-core-patient';
export const PASSAYGE_FHIR = 'https://henrycarto.com/passayge/fhir';
export const RECORD_KIND_SYSTEM = `${PASSAYGE_FHIR}/CodeSystem/record-kind`;
export const DATA_ORIGIN_SYSTEM = `${PASSAYGE_FHIR}/CodeSystem/data-origin`;
export const PROVIDER_ID_SYSTEM = `${PASSAYGE_FHIR}/sid/provider`;
export const ABNORMAL_COUNT = `${PASSAYGE_FHIR}/StructureDefinition/abnormal-count`;

export const SYNTHETIC_TAG = { system: DATA_ORIGIN_SYSTEM, code: 'synthetic', display: 'Synthetic test data' };

const narrativeDiv = (text: string) => ({
  status: 'generated' as const,
  div: `<div xmlns="http://www.w3.org/1999/xhtml">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`,
});

export function patientResource(p: SeedPatient): Patient {
  return {
    resourceType: 'Patient',
    id: p.id,
    meta: { profile: [AT_CORE_PATIENT], tag: [SYNTHETIC_TAG] },
    text: narrativeDiv(`${p.family.toUpperCase()}, ${p.given}. Synthetic patient. Born ${p.birthDate}.`),
    identifier: [
      {
        use: 'official',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'PI', display: 'Patient internal identifier' }], text: 'Synthetic social security number' },
        system: SYNTHETIC_SVNR_SYSTEM,
        value: p.svnr.replace(' ', ''),
      },
    ],
    active: true,
    name: [{ use: 'official', family: p.family, given: [p.given] }],
    gender: p.gender,
    birthDate: p.birthDate,
    address: [{ use: 'home', line: [p.line], city: p.city, postalCode: p.postalCode, state: p.state, country: 'AUT' }],
  };
}

export function organizationResources(): Organization[] {
  const orgs = new Map<string, { name: string; town: string }>();
  for (const p of PROVIDERS) orgs.set(p.id, { name: p.organisation, town: p.town });
  for (const a of Object.values(AUTHORS)) if (!orgs.has(a.id)) orgs.set(a.id, { name: a.name, town: a.town });
  return [...orgs].map(([id, o]) => ({
    resourceType: 'Organization',
    id,
    meta: { tag: [SYNTHETIC_TAG] },
    text: narrativeDiv(`${o.name}, ${o.town}. Synthetic organisation.`),
    identifier: [{ system: PROVIDER_ID_SYSTEM, value: id }],
    active: true,
    name: o.name,
    address: [{ city: o.town, country: 'AUT' }],
  }));
}

export function practitionerResources(): Practitioner[] {
  return PROVIDERS.map((p) => ({
    resourceType: 'Practitioner',
    id: `${p.id}-person`,
    meta: { tag: [SYNTHETIC_TAG] },
    text: narrativeDiv(`${p.person}, ${p.personTitle}. Synthetic person.`),
    active: true,
    name: [{ text: p.person }],
  }));
}

const toBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export function documentResources(doc: SeedDocument): [DocumentReference, Binary] {
  const patient = PATIENTS.find((p) => p.id === doc.patientId);
  if (!patient) throw new Error(`Unknown patient ${doc.patientId}`);
  const xml = buildCda(doc, patient);
  const type = LOINC_TYPE[doc.kind];
  const kind = recordKindOf(doc.kind);
  const binaryId = `${doc.id}-content`;
  const abnormal = doc.status === 'current' ? (doc.lab ?? []).filter((v) => v.flag !== 'N').length : 0;
  const ref: DocumentReference = {
    resourceType: 'DocumentReference',
    id: doc.id,
    meta: { tag: [SYNTHETIC_TAG] },
    text: narrativeDiv(`${doc.title}, ${doc.date.slice(0, 10)}. ${doc.summary}. Synthetic document.`),
    masterIdentifier: { system: 'urn:ietf:rfc:3986', value: `urn:oid:${SANDBOX_OID}.1.${DOCUMENTS.indexOf(doc) + 1}` },
    // Sandbox-only summary so abnormal results show in the list. ELGA registry entries do not carry it.
    ...(abnormal ? { extension: [{ url: ABNORMAL_COUNT, valueString: `${abnormal} result${abnormal === 1 ? '' : 's'} out of range` }] } : {}),
    status: doc.status,
    docStatus: 'final',
    type: { coding: [{ system: 'http://loinc.org', code: type.code, display: type.display }], text: doc.title },
    category: [{ coding: [{ system: RECORD_KIND_SYSTEM, code: kind, display: kind }] }],
    subject: { reference: `Patient/${patient.id}` },
    date: doc.date,
    author: [{ reference: `Organization/${doc.author.id}`, display: doc.author.name }],
    description: doc.summary,
    ...(doc.replaces ? { relatesTo: [{ code: 'replaces' as const, target: { reference: `DocumentReference/${doc.replaces}` } }] } : {}),
    content: [{ attachment: { contentType: 'text/xml', language: 'en', url: `Binary/${binaryId}`, title: doc.title, creation: doc.date } }],
  };
  const binary: Binary = { resourceType: 'Binary', id: binaryId, meta: { tag: [SYNTHETIC_TAG] }, contentType: 'text/xml', data: toBase64(xml) };
  return [ref, binary];
}

const put = (r: { resourceType: string; id?: string }): BundleEntry => ({
  fullUrl: `${r.resourceType}/${r.id}`,
  resource: r as BundleEntry['resource'],
  request: { method: 'PUT', url: `${r.resourceType}/${r.id}` },
});

/** The sandbox's record types, published so validators can check the category codes. */
export function recordKindCodeSystem(): CodeSystem {
  return {
    resourceType: 'CodeSystem',
    id: 'passayge-record-kind',
    meta: { tag: [SYNTHETIC_TAG] },
    text: narrativeDiv('Passayge record types: documents, medication, vaccinations. Sandbox code system.'),
    url: RECORD_KIND_SYSTEM,
    version: '0.1.0',
    name: 'PassaygeRecordKind',
    title: 'Passayge record types',
    status: 'active',
    experimental: true,
    description: 'The three record types the sandbox applies access rules to. Not an ELGA code system.',
    caseSensitive: true,
    content: 'complete',
    concept: [
      { code: 'documents', display: 'documents', definition: 'Documents such as discharge letters and reports (e-Befunde).' },
      { code: 'medication', display: 'medication', definition: 'Medication data (e-Medikation).' },
      { code: 'vaccinations', display: 'vaccinations', definition: 'The vaccination record (e-Impfpass).' },
    ],
  };
}

/** Directory data: organisations, practitioners and the sandbox code system. */
export function directoryBundle(): Bundle {
  return { resourceType: 'Bundle', type: 'transaction', entry: [recordKindCodeSystem(), ...organizationResources(), ...practitionerResources()].map(put) };
}

/**
 * One patient with their documents, as an IHE MHD Provide Document Bundle [ITI-65] would carry them.
 * PUT with fixed ids, so seeding twice changes nothing.
 */
export function patientBundle(p: SeedPatient): Bundle {
  const docs = DOCUMENTS.filter((d) => d.patientId === p.id).flatMap((d) => documentResources(d));
  return { resourceType: 'Bundle', type: 'transaction', meta: { tag: [SYNTHETIC_TAG] }, entry: [patientResource(p), ...docs].map(put) };
}
