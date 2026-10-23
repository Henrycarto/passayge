import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_SETTINGS, decide, decideStore, validateProviderDays, type Contact, type PatientSettings } from '../src/rules';

const AT = '2026-09-25T08:40:00.000Z';
const t0 = Date.parse(AT);
const contact: Contact = { id: 'c1', patientId: 'p1', providerId: 'doc', at: AT };
const at = (ms: number) => new Date(t0 + ms);
const settings = (s: Partial<PatientSettings> = {}): PatientSettings => ({ ...structuredClone(DEFAULT_SETTINGS), ...s });

const doctor = (kind: 'documents' | 'medication' | 'vaccinations', now: Date, s = settings(), contacts = [contact]) =>
  decide({ role: 'doctor', providerId: 'doc', kind, contacts, settings: s, now });

describe('time windows (§ 18 Abs. 6, § 24f Abs. 2)', () => {
  it('grants a doctor documents one millisecond before 90 days and expires them at exactly 90 days', () => {
    expect(doctor('documents', at(90 * DAY_MS - 1)).outcome).toBe('granted');
    const d = doctor('documents', at(90 * DAY_MS));
    expect(d).toMatchObject({ outcome: 'expired', reason: 'expired', days: 90, source: 'gtelg18_6' });
    expect(d.until).toBe(new Date(t0 + 90 * DAY_MS).toISOString());
  });

  it('gives the vaccination record 28 days for a doctor', () => {
    expect(doctor('vaccinations', at(28 * DAY_MS - 1)).outcome).toBe('granted');
    expect(doctor('vaccinations', at(28 * DAY_MS))).toMatchObject({ outcome: 'expired', days: 28, source: 'gtelg24f_2' });
  });

  it('gives a pharmacy 28 days for medication and never documents', () => {
    const c: Contact = { ...contact, providerId: 'ph' };
    const ph = (kind: 'documents' | 'medication', ms: number) => decide({ role: 'pharmacy', providerId: 'ph', kind, contacts: [c], settings: settings(), now: at(ms) });
    expect(ph('medication', 28 * DAY_MS - 1).outcome).toBe('granted');
    expect(ph('medication', 28 * DAY_MS).outcome).toBe('expired');
    expect(ph('documents', 0)).toMatchObject({ outcome: 'denied', reason: 'not-for-role', source: 'gtelg21_2' });
  });

  it('uses the latest contact and ignores contacts in the future', () => {
    const later: Contact = { ...contact, id: 'c2', at: new Date(t0 + 80 * DAY_MS).toISOString() };
    expect(doctor('documents', at(100 * DAY_MS), settings(), [contact, later]).outcome).toBe('granted');
    expect(doctor('documents', at(10 * DAY_MS), settings(), [later]).reason).toBe('no-contact');
  });

  it('treats contacts older than 365 days as gone', () => {
    const s = settings({ providerDays: { doc: 365 } });
    expect(doctor('documents', at(365 * DAY_MS - 1), s).outcome).toBe('granted');
    expect(doctor('documents', at(365 * DAY_MS), s).reason).toBe('no-contact');
  });
});

describe('patient settings (§ 15, § 16, § 18 Abs. 7)', () => {
  it('extends a trusted doctor to 365 days and cites § 18 Abs. 7', () => {
    const d = doctor('documents', at(200 * DAY_MS), settings({ providerDays: { doc: 365 } }));
    expect(d).toMatchObject({ outcome: 'granted', days: 365, source: 'gtelg18_7' });
  });

  it('never extends the vaccination record', () => {
    expect(doctor('vaccinations', at(30 * DAY_MS), settings({ providerDays: { doc: 365 } })).outcome).toBe('expired');
  });

  it('blocks a provider set to 0 days, but not for vaccinations', () => {
    const s = settings({ providerDays: { doc: 0 } });
    expect(doctor('documents', at(1), s)).toMatchObject({ outcome: 'denied', reason: 'blocked' });
    expect(doctor('vaccinations', at(1), s).outcome).toBe('granted');
  });

  it('applies partial and general opt-out, never to vaccinations', () => {
    const partial = settings({ optOut: { documents: false, medication: true } });
    expect(doctor('medication', at(1), partial)).toMatchObject({ outcome: 'denied', reason: 'opted-out', source: 'gtelg15' });
    expect(doctor('documents', at(1), partial).outcome).toBe('granted');
    const general = settings({ optOut: { documents: true, medication: true } });
    expect(doctor('documents', at(1), general).reason).toBe('opted-out');
    expect(doctor('vaccinations', at(1), general).outcome).toBe('granted');
  });

  it('refuses no contact at all', () => {
    expect(doctor('documents', at(1), settings(), [])).toMatchObject({ outcome: 'denied', reason: 'no-contact' });
  });

  it('lets patients extend doctors and pharmacies to 365 days but only shorten hospitals', () => {
    expect(() => validateProviderDays('doctor', 365)).not.toThrow();
    expect(() => validateProviderDays('pharmacy', 365)).not.toThrow();
    expect(() => validateProviderDays('doctor', 366)).toThrow(RangeError);
    expect(() => validateProviderDays('hospital', 91)).toThrow(RangeError);
    expect(() => validateProviderDays('hospital', 0)).not.toThrow();
    expect(() => validateProviderDays('doctor', 1.5)).toThrow(RangeError);
  });

  it('refuses to store data from a treatment case the patient objected to', () => {
    expect(decideStore('documents', { ...contact, objection: true }, settings())).toMatchObject({ outcome: 'denied', reason: 'objection' });
    expect(decideStore('documents', contact, settings()).outcome).toBe('granted');
  });
});
