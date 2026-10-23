import { describe, expect, it } from 'vitest';
import { DOCUMENTS, PATIENTS, buildCda } from '@passayge/core';
import { summarise } from '@/components/Banner';
import { toQuery } from '@/components/SideNav';
import type { AccessStatus, PublicDecision } from '@/lib/api';
import { cdaToIso, parseCda } from '@/lib/cda';
import { ageOn, fmtDuration, fmtSvnr } from '@/lib/format';

describe('patient search box', () => {
  it('turns one input into PDQm parameters', () => {
    expect(toQuery('Brandst')).toEqual({ family: 'Brandst' });
    expect(toQuery('Brandstätter Theresia')).toEqual({ family: 'Brandstätter', given: 'Theresia' });
    expect(toQuery('14.03.1962')).toEqual({ birthdate: '1962-03-14' });
    expect(toQuery('1962-03-14')).toEqual({ birthdate: '1962-03-14' });
    expect(toQuery('0495 140362')).toEqual({ identifier: '0495140362' });
    expect(toQuery('   ')).toBeUndefined();
  });
});

describe('formatting', () => {
  it('shows time left in days and hours', () => {
    expect(fmtDuration((61 * 24 + 20) * 3_600_000 + 59_000)).toBe('61 days, 20 hours');
    expect(fmtDuration(3_600_000)).toBe('1 hour');
    expect(fmtDuration(0)).toBe('0 hours');
  });

  it('counts age on the day in Vienna and formats SVNRs', () => {
    expect(ageOn('1962-03-14', new Date('2026-10-23T12:00:00Z'))).toBe(64);
    expect(ageOn('1962-10-24', new Date('2026-10-23T21:59:00Z'))).toBe(63);
    expect(ageOn('1962-10-24', new Date('2026-10-23T22:01:00Z'))).toBe(64); // already 24 Oct in Vienna
    expect(fmtSvnr('0495140362')).toBe('0495 140362');
  });
});

describe('the banner sentence', () => {
  const d = (outcome: PublicDecision['outcome'], extra: Partial<PublicDecision> = {}): PublicDecision =>
    ({ outcome, reason: outcome === 'granted' ? 'within-window' : outcome, kind: 'documents', source: 'gtelg18_6', explanation: 'Because.', sourceLabel: '', sourceUrl: '', ...extra }) as PublicDecision;
  const status = (role: 'doctor' | 'pharmacy', decisions: AccessStatus['decisions']): AccessStatus =>
    ({ now: '', actor: { role } as AccessStatus['actor'], decisions, settings: { optOut: { documents: false, medication: false }, providerDays: {} }, allowedDays: { min: 0, max: 365 } }) as AccessStatus;

  it('says how many functions are open and until when', () => {
    const until = '2026-12-24T08:40:03.000Z';
    const s = summarise(status('doctor', { documents: d('granted', { until }), medication: d('granted', { until }), vaccinations: d('expired', { until: '2026-10-23T08:40:03.000Z' }) }));
    expect(s.tone).toBe('granted');
    expect(s.title).toBe('Access granted, 2 of 3');
    expect(s.lines[0]).toBe('Documents and medication until 24 Dec 2026, 09:40.');
    expect(s.lines[1]).toBe('Vaccinations expired 23 Oct 2026, 10:40.');
  });

  it('tells the clinician what to do when there is no contact at all', () => {
    const s = summarise(status('doctor', { documents: d('denied', { reason: 'no-contact' }), medication: d('denied', { reason: 'no-contact' }), vaccinations: d('denied', { reason: 'no-contact' }) }));
    expect(s).toMatchObject({ tone: 'denied', title: 'No access' });
    expect(s.lines).toContain('Insert the e-card to request access.');
  });

  it('leaves documents out for a pharmacy instead of reporting them as refused', () => {
    const until = '2026-11-20T09:14:32.000Z';
    const s = summarise(status('pharmacy', { documents: d('denied', { reason: 'not-for-role' }), medication: d('granted', { until }), vaccinations: d('granted', { until }) }));
    expect(s.title).toBe('Access granted');
  });
});

describe('reading a CDA-like document', () => {
  const lab = DOCUMENTS.find((x) => x.id === 'doc-the-lab-20260930-v2')!;
  const parsed = parseCda(buildCda(lab, PATIENTS[0]!));

  it('turns lab entries into FHIR Observations for wardkit LabResult', () => {
    expect(parsed.observations).toHaveLength(lab.lab!.length);
    const hba1c = parsed.observations[0]!;
    expect(hba1c.code.coding?.[0]).toMatchObject({ system: 'http://loinc.org', code: '4548-4' });
    expect(hba1c.valueQuantity).toMatchObject({ value: 7.8, unit: '%' });
    expect(hba1c.interpretation?.[0]?.coding?.[0]?.code).toBe('H');
    expect(hba1c.referenceRange?.[0]).toMatchObject({ low: { value: 4 }, high: { value: 5.6 } });
    const egfr = parsed.observations.find((o) => o.code.coding?.[0]?.code === '98979-8')!;
    expect(egfr.valueQuantity?.unit).toBe('mL/min/1.73 m²');
    expect(egfr.referenceRange?.[0]?.high).toBeUndefined();
  });

  it('reads narrative sections', () => {
    const d = DOCUMENTS.find((x) => x.id === 'doc-the-discharge-20261009')!;
    const p = parseCda(buildCda(d, PATIENTS[0]!));
    expect(p.sections.map((s) => s.title)).toEqual(['Reason for admission', 'Diagnoses', 'Procedure', 'Course', 'Recommendations']);
    expect(p.sections[1]!.items).toContain('Type 2 diabetes mellitus (E11.9)');
    expect(p.author).toBe('OA Dr. Martin Pichler');
  });

  it('refuses broken XML with a plain message', () => {
    expect(() => parseCda('<ClinicalDocument')).toThrow('The document could not be read.');
  });

  it('converts CDA timestamps back to ISO', () => {
    expect(cdaToIso('20261009162044+0200')).toBe('2026-10-09T16:20:44+02:00');
    expect(cdaToIso('19620314')).toBe('1962-03-14');
    expect(cdaToIso('nonsense')).toBeUndefined();
  });
});
