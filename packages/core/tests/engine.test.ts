// The engine with the in-memory FHIR store: the path the browser demo takes. The gateway tests
// cover the same engine behind HTTP and HAPI.

import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { MemoryFhir } from '../src/engine/memory-fhir';
import { NetLog } from '../src/engine/netlog';
import { SimClock } from '../src/engine/clock';
import { seedFhir } from '../src/engine/seed-fhir';
import { SIM_START } from '../src/seed';

let engine: Engine;
let fhir: MemoryFhir;

beforeEach(async () => {
  const clock = new SimClock(SIM_START, () => 0);
  const netlog = new NetLog();
  fhir = new MemoryFhir(netlog, clock);
  engine = new Engine({ fhir, clock, netlog });
  await seedFhir(fhir);
  netlog.clear();
});

const call = async (method: string, url: string, body?: unknown) => {
  const r = await engine.handle({ method, url, body });
  return { status: r.status, type: r.type, json: () => JSON.parse(r.body), text: r.body };
};
const tx = () => engine.netlog.since().map((e) => e.transaction);

describe('engine with the in-memory FHIR store (demo mode)', () => {
  it('finds patients by name, umlaut and all, and by synthetic SVNR', async () => {
    expect((await call('GET', '/fhir/Patient?family=brandst%C3%A4tter')).json().entry).toHaveLength(2);
    expect((await call('GET', '/fhir/Patient?identifier=0495%20140362')).json().entry).toHaveLength(1);
    expect(tx()).toEqual(['ITI-78', 'ITI-78']);
  });

  it('grants a doctor documents and logs access, ITI-67 and ITI-20', async () => {
    const r = await call('GET', '/fhir/DocumentReference?patient=Patient/pas-theresia&category=documents');
    expect(r.status).toBe(200);
    expect(r.json().entry.map((e: { resource: { id: string } }) => e.resource.id)[0]).toBe('doc-the-discharge-20261009');
    expect(tx()).toEqual(['access', 'ITI-67', 'ITI-20']);
  });

  it('returns the document XML for ITI-68', async () => {
    const r = await call('GET', '/fhir/Binary/doc-the-lab-20260930-v2-content');
    expect(r.status).toBe(200);
    expect(r.type).toContain('text/xml');
    expect(r.text).toContain('<ClinicalDocument');
  });

  it('denies a pharmacy documents, and records it', async () => {
    await call('POST', '/api/session/actor', { providerId: 'prov-hirsch' });
    expect((await call('GET', '/fhir/DocumentReference?patient=Patient/pas-theresia&category=documents')).status).toBe(403);
    const audit = (await call('GET', '/api/audit?patient=pas-theresia')).json().records;
    expect(audit[0]).toMatchObject({ outcome: 'denied', reason: 'not-for-role' });
  });

  it('turns no contact into access after the e-card, then expires with the clock', async () => {
    await call('POST', '/api/session/actor', { providerId: 'prov-wimmer' });
    const url = '/fhir/DocumentReference?patient=Patient/pas-theresia&category=documents';
    expect((await call('GET', url)).status).toBe(403);
    expect((await call('POST', '/api/contacts', { patientId: 'pas-theresia' })).status).toBe(201);
    expect((await call('GET', url)).status).toBe(200);
    await call('POST', '/api/clock', { days: 90 });
    expect((await call('GET', url)).status).toBe(403);
  });

  it('applies the patient portal and refuses an extended hospital', async () => {
    expect((await call('PUT', '/api/settings/pas-theresia', { providerDays: { 'prov-kgf': 365 } })).status).toBe(400);
    expect((await call('PUT', '/api/settings/pas-theresia', { optOut: { documents: true, medication: false } })).status).toBe(200);
    expect((await call('GET', '/fhir/DocumentReference?patient=Patient/pas-theresia&category=documents')).status).toBe(403);
  });

  it('resets: session audit gone, history kept', async () => {
    await call('GET', '/fhir/DocumentReference?patient=Patient/pas-theresia&category=documents');
    await call('POST', '/api/reset', {});
    const records = (await call('GET', '/api/audit?patient=pas-theresia')).json().records as { id: string }[];
    expect(records.every((r) => r.id.startsWith('hist-'))).toBe(true);
  });

  it('answers unknown paths with 404', async () => {
    expect((await call('GET', '/api/nothing')).status).toBe(404);
    expect((await call('DELETE', '/fhir/Patient/pas-theresia')).status).toBe(404);
  });
});
