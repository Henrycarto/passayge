// Runs the gateway against a real HAPI FHIR server (Docker), so the IHE transactions, the
// AT Core validation and the audit trail are checked end to end.
// Needs: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d hapi

import { beforeAll, describe, expect, it } from 'vitest';
import { AT_CORE_PATIENT, PATIENTS, SIM_START, fromAuditEvent, patientResource } from '@passayge/core';
import { buildApp, type Sandbox } from '../src/app';
import { SimClock } from '../src/clock';
import { seed, waitForHapi } from '../src/seed';
import { resourcesToValidate, validate } from '../scripts/validate-fhir';

const HAPI_URL = process.env.HAPI_URL ?? 'http://localhost:8091/fhir';
let sb: Sandbox;

beforeAll(async () => {
  sb = buildApp({ hapiBase: HAPI_URL, clock: new SimClock(SIM_START) });
  await waitForHapi(sb.hapi);
  await seed(sb.hapi);
});

const req = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => sb.app.inject({ method, url, ...(payload ? { payload } : {}) });

describe('against HAPI FHIR with HL7 Austria FHIR Core 2.0.0', () => {
  it('has the AT Core Patient profile installed', async () => {
    const r = await sb.hapi.call('ITI-78', 'test', 'GET', `StructureDefinition?url=${encodeURIComponent(AT_CORE_PATIENT)}`, { quiet: true });
    expect(JSON.parse(r.body).total).toBe(1);
  });

  it('validates every synthetic patient against AT Core without errors', async () => {
    for (const p of PATIENTS) {
      const oo = await validate(patientResource(p), AT_CORE_PATIENT);
      expect(oo.issue?.filter((i) => i.severity === 'error' || i.severity === 'fatal') ?? [], p.id).toEqual([]);
    }
  });

  it('rejects a patient that breaks AT Core (no name, no gender)', async () => {
    const bad = { ...patientResource(PATIENTS[0]!), name: undefined, gender: undefined };
    const oo = await validate(bad, AT_CORE_PATIENT);
    const errors = (oo.issue ?? []).filter((i) => i.severity === 'error').map((i) => i.diagnostics);
    expect(errors.join(' ')).toMatch(/Patient\.name: minimum required = 1/);
    expect(errors.join(' ')).toMatch(/Patient\.gender: minimum required = 1/);
  });

  it('validates every resource the sandbox writes without errors', async () => {
    for (const { label, resource, profile } of resourcesToValidate()) {
      const oo = await validate(resource, profile);
      expect(oo.issue?.filter((i) => i.severity === 'error' || i.severity === 'fatal').map((i) => i.diagnostics) ?? [], label).toEqual([]);
    }
  });

  it('runs ITI-78, ITI-67, ITI-68, ITI-20 and ITI-81 end to end', async () => {
    await req('POST', '/api/reset', {});
    const search = await req('GET', '/fhir/Patient?family=Brandst%C3%A4tter');
    expect(search.json().entry.length).toBe(2);

    const list = await req('GET', '/fhir/DocumentReference?patient=Patient/pas-theresia&category=documents');
    expect(list.statusCode).toBe(200);
    const ids = list.json().entry.map((e: { resource: { id: string } }) => e.resource.id);
    expect(ids).toContain('doc-the-lab-20260930-v2');

    const doc = await req('GET', '/fhir/Binary/doc-the-lab-20260930-v2-content');
    expect(doc.statusCode).toBe(200);
    expect(doc.body).toContain('code="4548-4"');

    const audit = (await req('GET', '/api/audit?patient=pas-theresia')).json().records;
    expect(audit[0]).toMatchObject({ description: 'Opened document', outcome: 'granted' });
    expect(audit[1]).toMatchObject({ description: 'Searched documents', outcome: 'granted' });

    const seen = new Set(sb.netlog.since().map((e) => e.transaction));
    for (const t of ['ITI-78', 'ITI-67', 'ITI-68', 'ITI-20', 'ITI-81']) expect(seen.has(t as never), t).toBe(true);
  });

  it('stores a denial in HAPI as an AuditEvent with the rule and reason', async () => {
    await req('POST', '/api/session/actor', { providerId: 'prov-hirsch' });
    expect((await req('GET', '/fhir/DocumentReference?patient=Patient/pas-theresia&category=documents')).statusCode).toBe(403);
    const r = await sb.hapi.call('ITI-81', 'test', 'GET', 'AuditEvent?entity=Patient/pas-theresia&_sort=-date&_count=1', { quiet: true });
    const rec = fromAuditEvent(JSON.parse(r.body).entry[0].resource)!;
    expect(rec).toMatchObject({ outcome: 'denied', reason: 'not-for-role', source: 'gtelg21_2', person: 'Mag. pharm. Florian Gruber' });
    await req('POST', '/api/session/actor', { providerId: 'prov-aigner' });
  });

  it('reset deletes session audit events from HAPI and keeps the history', async () => {
    await req('POST', '/api/reset', {});
    const records = (await req('GET', '/api/audit?patient=pas-theresia')).json().records as { id: string }[];
    expect(records.length).toBeGreaterThan(5);
    expect(records.every((r) => r.id.startsWith('hist-'))).toBe(true);
  });
});
