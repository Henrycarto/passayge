import { beforeEach, describe, expect, it } from 'vitest';
import { fromAuditEvent, SIM_START, SYNTHETIC_SVNR_SYSTEM } from '@passayge/core';
import { buildApp, type Sandbox } from '../src/app';
import { SimClock } from '../src/clock';
import { EgressBlockedError, guardedFetch } from '../src/egress';
import { USER_AGENT } from '../src/hapi';
import { seed } from '../src/seed';
import { HAPI, fakeHapi, type FakeHapi } from './fake-hapi';

let hapi: FakeHapi;
let sb: Sandbox;

async function start(clock = new SimClock(SIM_START, () => 0)) {
  hapi = fakeHapi();
  sb = buildApp({ hapiBase: HAPI, fetch: hapi.fetch, clock });
  await seed(sb.hapi);
  hapi.calls.length = 0;
  sb.netlog.clear();
}

const req = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  sb.app.inject({ method, url, ...(payload !== undefined ? { payload: payload as object } : {}) });
const as = (providerId: string) => req('POST', '/api/session/actor', { providerId });
const docs = (patient: string, category: string) => req('GET', `/fhir/DocumentReference?patient=Patient/${patient}&category=${category}`);
const lastAudit = () => {
  const list = hapi.audits().map((a) => fromAuditEvent(a)!).filter((a) => !a.id?.startsWith('hist-'));
  return list[list.length - 1]!;
};
const transactions = () => sb.netlog.since().map((e) => e.transaction);

beforeEach(async () => {
  await start();
});

describe('no request leaves the sandbox', () => {
  it('blocks any origin other than the sandbox FHIR server', async () => {
    const f = guardedFetch([HAPI], async () => new Response('ok'));
    await expect(f('https://www.elga.gv.at/')).rejects.toBeInstanceOf(EgressBlockedError);
    await expect(f('https://example.org/fhir/Patient')).rejects.toBeInstanceOf(EgressBlockedError);
    await expect(f('not a url')).rejects.toBeInstanceOf(EgressBlockedError);
    await expect(f(`${HAPI}/Patient`)).resolves.toBeInstanceOf(Response);
  });

  it('sends every call of a full session only to the sandbox FHIR server, as Passayge, with no personal data', async () => {
    await req('GET', '/fhir/Patient?family=brandst');
    await docs('pas-theresia', 'documents');
    await req('GET', '/fhir/Binary/doc-the-lab-20260930-v2-content');
    await req('POST', '/api/contacts', { patientId: 'pas-theresia' });
    await req('GET', '/api/audit?patient=pas-theresia');
    await req('POST', '/api/reset', {});
    expect(hapi.calls.length).toBeGreaterThan(5);
    for (const c of hapi.calls) {
      expect(new URL(c.url).origin).toBe(new URL(HAPI).origin);
      expect(c.headers['user-agent']).toBe(USER_AGENT);
      expect(c.headers['cache-control']).toBe('no-cache');
      expect(JSON.stringify(c)).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    }
  });
});

describe('PDQm Mobile Patient Demographics Query [ITI-78]', () => {
  it('finds patients by family name', async () => {
    const r = await req('GET', '/fhir/Patient?family=brandst');
    expect(r.statusCode).toBe(200);
    expect(r.json().entry).toHaveLength(2);
    expect(transactions()).toEqual(['ITI-78']);
  });

  it('searches a synthetic SVNR in the sandbox identifier system', async () => {
    const r = await req('GET', '/fhir/Patient?identifier=0495%20140362');
    expect(r.json().entry).toHaveLength(1);
    expect(hapi.calls[0]!.url).toContain(encodeURIComponent(`${SYNTHETIC_SVNR_SYSTEM}|0495140362`));
  });

  it('asks for a search term instead of listing everyone', async () => {
    const r = await req('GET', '/fhir/Patient');
    expect(r.statusCode).toBe(400);
    expect(r.json().issue[0].diagnostics).toMatch(/name, date of birth or social security number/);
  });
});

describe('MHD Find Document References [ITI-67] and Retrieve Document [ITI-68]', () => {
  it('lets a doctor within 90 days search and open documents, and logs each step', async () => {
    const s = await docs('pas-theresia', 'documents');
    expect(s.statusCode).toBe(200);
    expect(s.json().entry).toHaveLength(5);
    expect(transactions()).toEqual(['access', 'ITI-67', 'ITI-20']);
    expect(lastAudit()).toMatchObject({ outcome: 'granted', processing: 'search', description: 'Searched documents', dataLabel: '5 found', person: 'Dr. Lena Aigner', source: 'gtelg18_6' });

    sb.netlog.clear();
    const b = await req('GET', '/fhir/Binary/doc-the-lab-20260930-v2-content');
    expect(b.statusCode).toBe(200);
    expect(b.headers['content-type']).toContain('text/xml');
    expect(b.body).toContain('<ClinicalDocument');
    expect(transactions()).toEqual(['access', 'access', 'ITI-68', 'ITI-20']);
    expect(lastAudit()).toMatchObject({ outcome: 'granted', processing: 'read', description: 'Opened document', dataRef: 'DocumentReference/doc-the-lab-20260930-v2' });
  });

  it('refuses documents to a pharmacy without asking the registry (§ 21 Abs. 2)', async () => {
    await as('prov-hirsch');
    const r = await docs('pas-theresia', 'documents');
    expect(r.statusCode).toBe(403);
    expect(r.json().issue[0].diagnostics).toBe('Pharmacies may see medication data only.');
    expect(transactions()).toEqual(['access', 'ITI-20']);
    expect(hapi.calls.some((c) => c.url.includes('DocumentReference?'))).toBe(false);
    expect(lastAudit()).toMatchObject({ outcome: 'denied', reason: 'not-for-role', role: 'pharmacy' });
  });

  it('gives the pharmacy medication within 28 days', async () => {
    await as('prov-hirsch');
    expect((await docs('pas-theresia', 'medication')).statusCode).toBe(200);
  });

  it('reports the vaccination record as expired after 28 days (§ 24f Abs. 2)', async () => {
    const r = await docs('pas-theresia', 'vaccinations');
    expect(r.statusCode).toBe(403);
    const decision = JSON.parse(r.json().extension[0].valueString);
    expect(decision).toMatchObject({ outcome: 'expired', days: 28, sourceLabel: '§ 24f Abs. 2 GTelG 2012' });
    expect(lastAudit()).toMatchObject({ outcome: 'expired', kind: 'vaccinations' });
  });

  it('applies the rules to a single document too, so a blocked doctor cannot open it', async () => {
    const r = await req('GET', '/fhir/Binary/doc-luk-imaging-20261012-content');
    expect(r.statusCode).toBe(403);
    expect(lastAudit()).toMatchObject({ outcome: 'denied', reason: 'blocked' });
  });

  it('rejects a search without patient or category', async () => {
    expect((await req('GET', '/fhir/DocumentReference?patient=Patient/pas-theresia')).statusCode).toBe(400);
    expect((await req('GET', '/fhir/DocumentReference?category=documents')).statusCode).toBe(400);
  });
});

describe('the expiry boundary, exactly', () => {
  // Dr. Aigner's contact for Theresia: 25 Sep 2026 08:40:03 UTC; 90 x 24 h later is 24 Dec 2026 08:40:03 UTC.
  const END = Date.parse('2026-12-24T08:40:03.000Z');

  it('grants one millisecond before the end', async () => {
    await start(new SimClock(new Date(END - 1).toISOString(), () => 0));
    expect((await docs('pas-theresia', 'documents')).statusCode).toBe(200);
  });

  it('refuses at the exact end and says it expired', async () => {
    await start(new SimClock(new Date(END).toISOString(), () => 0));
    const r = await docs('pas-theresia', 'documents');
    expect(r.statusCode).toBe(403);
    expect(lastAudit()).toMatchObject({ outcome: 'expired', reason: 'expired' });
  });

  it('moves with the simulated clock', async () => {
    expect((await docs('pas-theresia', 'documents')).statusCode).toBe(200);
    expect((await req('POST', '/api/clock', { days: 62 })).statusCode).toBe(200);
    expect((await docs('pas-theresia', 'documents')).statusCode).toBe(403);
    expect(transactions()).toContain('clock');
  });

  it('never moves the clock backwards', async () => {
    expect((await req('POST', '/api/clock', { days: -1 })).statusCode).toBe(400);
  });
});

describe('contact confirmation', () => {
  it('turns no-contact into access when the e-card is inserted, and records it', async () => {
    await as('prov-wimmer');
    const before = await docs('pas-theresia', 'documents');
    expect(before.statusCode).toBe(403);
    expect(lastAudit()).toMatchObject({ outcome: 'denied', reason: 'no-contact' });

    const c = await req('POST', '/api/contacts', { patientId: 'pas-theresia' });
    expect(c.statusCode).toBe(201);
    expect(lastAudit()).toMatchObject({ outcome: 'recorded', processing: 'contact', person: 'Dr. Johannes Wimmer' });
    expect(transactions()).toContain('contact');

    expect((await docs('pas-theresia', 'documents')).statusCode).toBe(200);
  });

  it('records an objection for the visit', async () => {
    const c = await req('POST', '/api/contacts', { patientId: 'pas-theresia', objection: true });
    expect(c.json().contact.objection).toBe(true);
    expect(lastAudit().explanation).toMatch(/objected/);
  });

  it('shows all three decisions for the banner', async () => {
    const a = (await req('GET', '/api/access/pas-theresia')).json();
    expect(a.decisions.documents.outcome).toBe('granted');
    expect(a.decisions.medication.outcome).toBe('granted');
    expect(a.decisions.vaccinations.outcome).toBe('expired');
    expect(a.decisions.documents.until).toBe('2026-12-24T08:40:03.000Z');
  });
});

describe('patient settings (§ 15, § 16, § 18 Abs. 7)', () => {
  it('honours a general opt-out but keeps the vaccination record', async () => {
    expect((await docs('pas-maria', 'documents')).statusCode).toBe(403);
    expect(lastAudit()).toMatchObject({ reason: 'opted-out', source: 'gtelg15' });
    expect((await docs('pas-maria', 'medication')).statusCode).toBe(403);
    expect((await docs('pas-maria', 'vaccinations')).statusCode).toBe(200);
  });

  it('honours a partial opt-out of medication only', async () => {
    expect((await docs('pas-ferdinand', 'medication')).statusCode).toBe(403);
    expect((await docs('pas-ferdinand', 'documents')).statusCode).toBe(200);
  });

  it('keeps a trusted family doctor in after 200 days, but not the hospital after 105', async () => {
    expect((await docs('pas-herta', 'documents')).statusCode).toBe(200);
    expect(lastAudit()).toMatchObject({ source: 'gtelg18_7' });
    await as('prov-kgf');
    expect((await docs('pas-herta', 'documents')).statusCode).toBe(403);
    expect(lastAudit()).toMatchObject({ outcome: 'expired' });
  });

  it('refuses to extend a hospital beyond 90 days', async () => {
    const r = await req('PUT', '/api/settings/pas-theresia', { providerDays: { 'prov-kgf': 365 } });
    expect(r.statusCode).toBe(400);
    expect(r.json().issue[0].diagnostics).toMatch(/0 to 90/);
  });

  it('applies a block set in the portal straight away, and logs the change', async () => {
    expect((await req('PUT', '/api/settings/pas-theresia', { providerDays: { 'prov-aigner': 0 } })).statusCode).toBe(200);
    expect(lastAudit()).toMatchObject({ processing: 'settings', outcome: 'recorded', person: 'The patient' });
    expect((await docs('pas-theresia', 'documents')).statusCode).toBe(403);
    expect(lastAudit()).toMatchObject({ reason: 'blocked' });
    await req('PUT', '/api/settings/pas-theresia', { providerDays: { 'prov-aigner': null } });
    expect((await docs('pas-theresia', 'documents')).statusCode).toBe(200);
  });

  it('does not allow an opt-out from the vaccination record', async () => {
    await req('PUT', '/api/settings/pas-theresia', { optOut: { documents: true, medication: true } });
    await as('prov-hirsch');
    expect((await docs('pas-theresia', 'vaccinations')).statusCode).toBe(200);
  });
});

describe('Retrieve ATNA Audit Event [ITI-81] and reset', () => {
  it('reads the audit log for one patient, newest first, history included', async () => {
    await docs('pas-theresia', 'documents');
    const r = (await req('GET', '/api/audit?patient=pas-theresia')).json();
    expect(r.records[0]).toMatchObject({ description: 'Searched documents', outcome: 'granted' });
    expect(r.records.some((x: { id: string }) => x.id === 'hist-att-1')).toBe(true);
    expect(transactions()).toContain('ITI-81');
  });

  it('links each audit entry to its network calls by transaction number', async () => {
    await docs('pas-theresia', 'documents');
    const a = lastAudit();
    const n = (await req('GET', `/api/network/${a.transactionNumber}`)).json().entries;
    expect(n.map((e: { transaction: string }) => e.transaction)).toEqual(['access', 'ITI-67', 'ITI-20']);
  });

  it('reset removes session entries and keeps the history', async () => {
    await docs('pas-theresia', 'documents');
    const history = hapi.audits().filter((a) => a.id?.startsWith('hist-')).length;
    expect((await req('POST', '/api/reset', {})).statusCode).toBe(200);
    expect(hapi.audits().filter((a) => !a.id?.startsWith('hist-'))).toHaveLength(0);
    expect(hapi.audits()).toHaveLength(history);
    expect(sb.netlog.since()).toHaveLength(0);
  });
});
