import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromAuditEvent, toAuditEvent, type AuditRecord } from '../src/audit';
import { buildCda, cdaTime } from '../src/cda';
import { patientBundle, patientResource, AT_CORE_PATIENT } from '../src/fhir';
import { GLOSSARY, GLOSSARY_BY_ID } from '../src/glossary';
import { historyRecords } from '../src/history';
import { TRANSACTIONS } from '../src/ihe';
import { CONTACTS, DOCUMENTS, PATIENTS, PROVIDERS, SETTINGS } from '../src/seed';
import { checkDigit, isSyntheticSvnr, isValidSvnr, syntheticSvnr, SYNTHETIC_SVNR_SYSTEM } from '../src/svnr';

describe('synthetic SVNR', () => {
  it('computes the check digit with weights 3 7 9 5 8 4 2 1 6 modulo 11', () => {
    expect(checkDigit('123', '010170')).toBe(6);
    expect(isValidSvnr('1236 010170')).toBe(true);
    expect(isValidSvnr('1237 010170')).toBe(false);
  });

  it('skips a serial whose check digit would be 10', () => {
    expect(checkDigit('026', '110503')).toBeUndefined();
    expect(syntheticSvnr('2003-05-11', 26)).toBe('0278 110503');
  });

  it('only ever creates serials below 100, which are never issued', () => {
    for (const p of PATIENTS) {
      expect(isSyntheticSvnr(p.svnr), p.id).toBe(true);
      expect(Number(p.svnr.slice(0, 3))).toBeLessThan(100);
    }
    expect(isSyntheticSvnr('1236 010170')).toBe(false);
  });

  it('never uses the real SVNR identifier system', () => {
    const json = JSON.stringify(PATIENTS.map((p) => patientBundle(p)));
    expect(json).not.toContain('1.2.40.0.10.1.4.3.1');
    expect(patientResource(PATIENTS[0]!).identifier?.[0]?.system).toBe(SYNTHETIC_SVNR_SYSTEM);
  });
});

describe('synthetic world', () => {
  it('tags every patient as synthetic and claims the AT Core profile', () => {
    for (const p of PATIENTS) {
      const r = patientResource(p);
      expect(r.meta?.profile).toEqual([AT_CORE_PATIENT]);
      expect(r.meta?.tag?.[0]?.code).toBe('synthetic');
      expect(r.name?.[0]?.family).toBeTruthy();
      expect(r.gender).toBeTruthy();
    }
  });

  it('has no placeholder names', () => {
    const names = [...PATIENTS.map((p) => `${p.given} ${p.family}`), ...PROVIDERS.map((p) => p.person)].join(' ');
    expect(names).not.toMatch(/doe|test|mustermann|patient \d/i);
  });

  it('stores nothing a patient opted out of', () => {
    for (const d of DOCUMENTS) {
      const s = SETTINGS[d.patientId]!;
      if (d.kind === 'medication') expect(s.optOut.medication, d.id).toBe(false);
      else if (d.kind !== 'vaccinations') expect(s.optOut.documents, d.id).toBe(false);
    }
  });

  it('only refers to known patients and providers', () => {
    const pids = new Set(PATIENTS.map((p) => p.id));
    const prov = new Set(PROVIDERS.map((p) => p.id));
    for (const c of CONTACTS) {
      expect(pids.has(c.patientId)).toBe(true);
      expect(prov.has(c.providerId)).toBe(true);
    }
  });
});

describe('CDA-like documents', () => {
  const lab = DOCUMENTS.find((d) => d.id === 'doc-the-lab-20260930-v2')!;
  const xml = buildCda(lab, PATIENTS[0]!);

  it('converts ISO times to CDA timestamps', () => {
    expect(cdaTime('2026-10-09T16:20:44+02:00')).toBe('20261009162044+0200');
    expect(cdaTime('1962-03-14')).toBe('19620314');
    expect(cdaTime('2026-10-23T12:05:00.000Z')).toBe('20261023120500+0000');
  });

  it('says it is a sandbox document and carries no ELGA template ids', () => {
    expect(xml).toContain('not an ELGA-conformant document');
    expect(xml).not.toMatch(/1\.2\.40\.0\.34\./);
  });

  it('carries every lab value as a coded entry', () => {
    expect(xml.match(/<observation /g)?.length).toBe(lab.lab!.length);
    expect(xml).toContain('code="4548-4"');
    expect(xml).toContain('interpretationCode code="H"');
  });

  it('escapes text', () => {
    const doc = { ...lab, title: 'A & B <test>' };
    expect(buildCda(doc, PATIENTS[0]!)).toContain('<title>A &amp; B &lt;test&gt;</title>');
  });
});

describe('audit records (§ 22 Abs. 2 GTelG 2012)', () => {
  const r: AuditRecord = {
    id: 'x1', at: '2026-10-23T12:02:31.204Z', transactionNumber: 'abc-123', processing: 'search', description: 'Searched documents', dataLabel: 'Documents',
    query: 'patient=Patient/pas-theresia&category=documents', outcome: 'denied', reason: 'not-for-role', explanation: 'Pharmacies may see medication data only.', source: 'gtelg21_2',
    kind: 'documents', patientId: 'pas-theresia', providerId: 'prov-hirsch', organisation: 'Apotheke zum Silbernen Hirschen', person: 'Mag. pharm. Florian Gruber', personRef: 'prov-hirsch-person', role: 'pharmacy',
  };

  it('keeps every required field through a FHIR AuditEvent round trip', () => {
    const e = toAuditEvent(r);
    expect(e.recorded).toBe(r.at);
    expect(e.outcome).toBe('4');
    expect(e.agent?.[0]?.who?.display).toBe(r.person);
    expect(e.agent?.[1]?.who?.display).toBe(r.organisation);
    const back = fromAuditEvent({ ...e, id: 'x1' })!;
    expect(back).toMatchObject({
      at: r.at, transactionNumber: r.transactionNumber, processing: 'search', person: r.person, organisation: r.organisation,
      dataLabel: r.dataLabel, query: r.query, outcome: 'denied', reason: 'not-for-role', explanation: r.explanation, providerId: r.providerId,
    });
  });

  it('records a patient acting in the portal without a provider', () => {
    const e = toAuditEvent({ ...r, processing: 'settings', outcome: 'recorded', providerId: '', organisation: 'Access portal (simulated)', person: 'The patient', personRef: undefined, role: 'patient' });
    expect(e.agent).toHaveLength(1);
    expect(e.agent?.[0]?.who?.reference).toBe('Patient/pas-theresia');
    expect(e.outcome).toBe('0');
  });

  it('marks session entries so a reset can remove them, and history entries not', () => {
    expect(toAuditEvent(r).meta?.tag?.some((t) => t.code === 'session')).toBe(true);
    expect(toAuditEvent(r, false).meta?.tag?.some((t) => t.code === 'session')).toBe(false);
  });
});

describe('seeded audit history', () => {
  const h = historyRecords();
  const byId = (id: string) => h.find((x) => x.id === id)!;

  it('has a recorded entry for every contact and every stored document', () => {
    expect(h.filter((x) => x.processing === 'contact')).toHaveLength(CONTACTS.length);
    expect(h.filter((x) => x.processing === 'create')).toHaveLength(DOCUMENTS.length);
  });

  it('decides past attempts with the same rules', () => {
    expect(byId('hist-att-1')).toMatchObject({ outcome: 'denied', reason: 'no-contact' });
    expect(byId('hist-att-2')).toMatchObject({ outcome: 'expired', reason: 'expired' });
    expect(byId('hist-att-3')).toMatchObject({ outcome: 'granted' });
    expect(byId('hist-att-4')).toMatchObject({ outcome: 'denied', reason: 'not-for-role' });
  });

  it('is in time order and before the simulated start', () => {
    const times = h.map((x) => x.at);
    expect([...times].sort()).toEqual(times);
    expect(times.every((t) => t < '2026-10-23T12:05:00.000Z')).toBe(true);
  });
});

describe('glossary and transactions', () => {
  it('has unique ids and short explanations', () => {
    expect(new Set(GLOSSARY.map((t) => t.id)).size).toBe(GLOSSARY.length);
    for (const t of GLOSSARY) {
      const sentences = t.explain.split(/(?<=[.!?])\s+(?=[A-Z"])/).length;
      expect(sentences, t.id).toBeLessThanOrEqual(3);
      expect(t.explain.length, t.id).toBeLessThan(240);
    }
  });

  it('defines every term the web client links to', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.tsx')) files.push(p);
      }
    };
    walk(join(__dirname, '../../../apps/web/src'));
    const used = new Set(files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/<Term id="([\w-]+)"/g)].map((m) => m[1]!)));
    expect(used.size).toBeGreaterThanOrEqual(20);
    for (const id of used) expect(GLOSSARY_BY_ID[id], id).toBeDefined();
  });

  it('names the ELGA counterpart for every IHE transaction', () => {
    for (const t of Object.values(TRANSACTIONS)) {
      if (t.id.startsWith('ITI-')) expect(t.elga, t.id).toBeTruthy();
      expect(t.explain.length).toBeGreaterThan(20);
    }
    expect(TRANSACTIONS['ITI-67'].elga).toContain('ITI-18');
    expect(TRANSACTIONS['ITI-68'].elga).toContain('ITI-43');
    expect(TRANSACTIONS['ITI-78'].elga).toContain('ITI-47');
  });
});
