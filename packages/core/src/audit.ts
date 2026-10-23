// One audit record per access, carrying the fields § 22 Abs. 2 GTelG 2012 requires: date and time,
// transaction number, type of processing, provider, natural person, data identifier, query
// criteria and error message. Stored in HAPI as a FHIR AuditEvent (ATNA FHIR Feed, ITI-20) and
// read back with ITI-81.

import type { AuditEvent, AuditEventEntity } from 'fhir/r4';
import type { DataKind, Reason } from './rules';
import type { SourceId } from './sources';
import { SYNTHETIC_TAG, PASSAYGE_FHIR } from './fhir';

export type AuditOutcome = 'granted' | 'denied' | 'expired' | 'recorded' | 'void';
export type Processing = 'search' | 'read' | 'create' | 'update' | 'contact' | 'settings';

export interface AuditRecord {
  id?: string;
  /** Simulated time, ISO. */
  at: string;
  transactionNumber: string;
  processing: Processing;
  /** What happened, e.g. "Opened document". */
  description: string;
  /** What it was about, e.g. "Laboratory report, 30 Sep 2026". */
  dataLabel: string;
  dataRef?: string;
  query?: string;
  outcome: AuditOutcome;
  reason?: Reason;
  explanation: string;
  source?: SourceId;
  kind?: DataKind;
  patientId: string;
  /** Empty when the patient acted, e.g. in the (simulated) access portal. */
  providerId: string;
  organisation: string;
  person: string;
  /** Practitioner id when the person has one in the directory. */
  personRef?: string;
  role: string;
}

export const SESSION_TAG = { system: `${PASSAYGE_FHIR}/CodeSystem/audit-origin`, code: 'session', display: 'Written during this sandbox session' };
const DETAIL = `${PASSAYGE_FHIR}/audit-detail`;

const SUBTYPE: Record<Processing, { code: string; display: string; action: AuditEvent['action'] }> = {
  search: { code: 'search-type', display: 'search-type', action: 'E' },
  read: { code: 'read', display: 'read', action: 'R' },
  create: { code: 'create', display: 'create', action: 'C' },
  update: { code: 'update', display: 'update', action: 'U' },
  contact: { code: 'create', display: 'create', action: 'C' },
  settings: { code: 'update', display: 'update', action: 'U' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

export function toAuditEvent(r: AuditRecord, session = true): AuditEvent {
  const st = SUBTYPE[r.processing];
  const details: Record<string, string | undefined> = {
    outcome: r.outcome,
    reason: r.reason,
    source: r.source,
    kind: r.kind,
    processing: r.processing,
    description: r.description,
    'transaction-number': r.transactionNumber,
    role: r.role,
    'provider-id': r.providerId || undefined,
  };
  const data: AuditEventEntity = {
    ...(r.dataRef ? { what: { reference: r.dataRef } } : {}),
    type: { system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type', code: '2', display: 'System Object' },
    name: r.dataLabel,
    ...(r.query ? { query: b64(r.query) } : {}),
    detail: Object.entries(details)
      .filter((e): e is [string, string] => e[1] !== undefined)
      .map(([type, valueString]) => ({ type: `${DETAIL}#${type}`, valueString })),
  };
  return {
    resourceType: 'AuditEvent',
    meta: { tag: session ? [SYNTHETIC_TAG, SESSION_TAG] : [SYNTHETIC_TAG] },
    text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${esc(`${r.at}: ${r.person} (${r.organisation || 'patient'}). ${r.description}: ${r.dataLabel}. ${r.outcome}. ${r.explanation}`)}</div>` },
    type: { system: 'http://terminology.hl7.org/CodeSystem/audit-event-type', code: 'rest', display: 'RESTful Operation' },
    subtype: [{ system: 'http://hl7.org/fhir/restful-interaction', code: st.code, display: st.display }],
    action: st.action,
    recorded: r.at,
    outcome: r.outcome === 'denied' || r.outcome === 'expired' ? '4' : '0',
    outcomeDesc: r.explanation,
    purposeOfEvent: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'TREAT', display: 'treatment' }] }],
    agent: r.providerId
      ? [
          { who: { ...(r.personRef ? { reference: `Practitioner/${r.personRef}` } : {}), display: r.person }, name: r.person, requestor: true },
          { who: { reference: `Organization/${r.providerId}`, display: r.organisation }, requestor: false },
        ]
      : [{ who: { reference: `Patient/${r.patientId}`, display: r.person }, name: r.person, requestor: true }],
    source: {
      observer: { display: 'Passayge gateway (sandbox)' },
      type: [{ system: 'http://terminology.hl7.org/CodeSystem/security-source-type', code: '4', display: 'Application Server' }],
    },
    entity: [
      {
        what: { reference: `Patient/${r.patientId}` },
        type: { system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type', code: '1', display: 'Person' },
        role: { system: 'http://terminology.hl7.org/CodeSystem/object-role', code: '1', display: 'Patient' },
      },
      data,
    ],
  };
}

export function fromAuditEvent(e: AuditEvent): AuditRecord | undefined {
  const patient = e.entity?.find((x) => x.role?.code === '1')?.what?.reference?.replace('Patient/', '');
  const data = e.entity?.find((x) => x.role?.code !== '1');
  if (!patient || !data || !e.recorded) return undefined;
  const d = Object.fromEntries((data.detail ?? []).map((x) => [x.type.split('#')[1], x.valueString ?? '']));
  const person = e.agent?.[0];
  const org = e.agent?.[1];
  return {
    id: e.id,
    at: e.recorded,
    transactionNumber: d['transaction-number'] ?? '',
    processing: (d.processing as Processing) ?? 'read',
    description: d.description ?? '',
    dataLabel: data.name ?? '',
    dataRef: data.what?.reference,
    query: data.query ? unb64(data.query) : undefined,
    outcome: (d.outcome as AuditOutcome) ?? 'recorded',
    reason: d.reason as Reason | undefined,
    explanation: e.outcomeDesc ?? '',
    source: d.source as SourceId | undefined,
    kind: d.kind as DataKind | undefined,
    patientId: patient,
    providerId: d['provider-id'] ?? '',
    organisation: org?.who?.display ?? '',
    person: person?.who?.display ?? '',
    personRef: person?.who?.reference?.startsWith('Practitioner/') ? person.who.reference.slice('Practitioner/'.length) : undefined,
    role: d.role ?? '',
  };
}
