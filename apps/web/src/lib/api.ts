// The client talks only to the sandbox gateway on its own origin. It never calls HAPI, ELGA, the
// e-card system or any other service, and it sends no personal data.

import type { Bundle, DocumentReference, Patient } from 'fhir/r4';
import type { AuditRecord, DataKind, Decision, PatientSettings, Provider, TransactionId } from '@passayge/core';

export interface PublicDecision extends Decision {
  explanation: string;
  sourceLabel: string;
  sourceUrl: string;
}

export interface Session {
  actor: Provider;
  providers: Provider[];
  now: string;
  simStart: string;
  timeZone: string;
}

export interface AccessStatus {
  now: string;
  actor: Provider;
  decisions: Record<DataKind, PublicDecision>;
  settings: PatientSettings;
  allowedDays: { min: number; max: number };
}

export interface NetEntry {
  id: number;
  action: string;
  at: string;
  transaction: TransactionId;
  method: string;
  path: string;
  status: number;
  ms: number;
  excerpt?: string;
  note?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly decision?: PublicDecision,
  ) {
    super(message);
  }
}

/** Fired after every call, so the network peek and the log refresh. */
export const CHANGED = 'passayge:changed';

async function request<T>(path: string, init?: RequestInit & { json?: unknown; silent?: boolean }, as: 'json' | 'text' = 'json'): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { accept: as === 'json' ? 'application/json, application/fhir+json' : 'text/xml', ...(init?.json !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (!init?.silent) window.dispatchEvent(new Event(CHANGED));
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    let decision: PublicDecision | undefined;
    try {
      const body = (await res.json()) as { issue?: { diagnostics?: string }[]; extension?: { valueString?: string }[] };
      message = body.issue?.[0]?.diagnostics ?? message;
      const ext = body.extension?.[0]?.valueString;
      if (ext) decision = JSON.parse(ext) as PublicDecision;
    } catch {
      // Not JSON; keep the generic message.
    }
    throw new ApiError(res.status, message, decision);
  }
  return (as === 'json' ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  session: () => request<Session>('/api/session', { silent: true }),
  setActor: (providerId: string) => request<{ actor: Provider }>('/api/session/actor', { method: 'POST', json: { providerId } }),
  advanceClock: (body: { days?: number; hours?: number; reset?: boolean }) => request<{ now: string }>('/api/clock', { method: 'POST', json: body }),
  reset: () => request<{ now: string }>('/api/reset', { method: 'POST', json: {} }),

  /** PDQm [ITI-78] */
  searchPatients: (params: Record<string, string>) => request<Bundle>(`/fhir/Patient?${new URLSearchParams(params)}`),
  patient: (id: string) => request<Patient>(`/fhir/Patient/${encodeURIComponent(id)}`),

  access: (patientId: string) => request<AccessStatus>(`/api/access/${encodeURIComponent(patientId)}`),
  insertCard: (patientId: string, objection: boolean) => request<{ contact: unknown }>('/api/contacts', { method: 'POST', json: { patientId, objection } }),
  saveSettings: (patientId: string, body: { optOut?: PatientSettings['optOut']; providerDays?: Record<string, number | null> }) =>
    request<{ settings: PatientSettings }>(`/api/settings/${encodeURIComponent(patientId)}`, { method: 'PUT', json: body }),

  /** MHD Find Document References [ITI-67] */
  documents: async (patientId: string, kind: DataKind) => {
    const b = await request<Bundle>(`/fhir/DocumentReference?patient=Patient/${encodeURIComponent(patientId)}&category=${kind}`);
    return (b.entry ?? []).map((e) => e.resource as DocumentReference);
  },
  /** MHD Retrieve Document [ITI-68] */
  retrieve: (binaryUrl: string) => request<string>(`/fhir/${binaryUrl}`, {}, 'text'),

  /** Retrieve ATNA Audit Event [ITI-81] */
  audit: (patientId: string) => request<{ records: AuditRecord[] }>(`/api/audit?patient=${encodeURIComponent(patientId)}`),
  network: (after = 0) => request<{ entries: NetEntry[] }>(`/api/network?after=${after}`, { silent: true }),
  networkFor: (action: string) => request<{ entries: NetEntry[] }>(`/api/network/${encodeURIComponent(action)}`, { silent: true }),
};
