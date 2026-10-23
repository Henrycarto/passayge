// Access rules for the sandbox. Only rules with a primary source are modelled; each decision
// names the source it came from. Pure functions: the caller passes the (simulated) time.

import { SOURCES, type SourceId } from './sources';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Provider types modelled in the sandbox (§ 2 Z 10 lit. a, d and c GTelG 2012). */
export type Role = 'doctor' | 'hospital' | 'pharmacy';

/** The three record types a clinician opens (e-Befunde, e-Medikation, e-Impfpass). */
export type DataKind = 'documents' | 'medication' | 'vaccinations';

export const DATA_KINDS: readonly DataKind[] = ['documents', 'medication', 'vaccinations'];

export interface Contact {
  id: string;
  patientId: string;
  providerId: string;
  /** ISO timestamp of the identity check, e.g. the e-card being inserted. */
  at: string;
  /** The patient objected to storing data from this treatment case (§ 16 Abs. 2 Z 2). */
  objection?: boolean;
}

export interface PatientSettings {
  /** Partial opt-out per type; both true is a general opt-out (§ 15 Abs. 2). */
  optOut: { documents: boolean; medication: boolean };
  /** Individual access period in days per provider: 0 blocks, up to 365 extends (§ 16 Abs. 1, § 18 Abs. 7). */
  providerDays: Record<string, number>;
}

export const DEFAULT_SETTINGS: PatientSettings = { optOut: { documents: false, medication: false }, providerDays: {} };

export type Outcome = 'granted' | 'denied' | 'expired';

export type Reason =
  | 'within-window'
  | 'no-contact'
  | 'expired'
  | 'blocked'
  | 'opted-out'
  | 'not-for-role'
  | 'objection';

export interface Decision {
  outcome: Outcome;
  reason: Reason;
  kind: DataKind;
  /** Length of the window that applied, in days. */
  days?: number;
  /** The contact the decision rests on. */
  contact?: Contact;
  /** When access ends (granted) or ended (expired), ISO. */
  until?: string;
  source: SourceId;
}

/** Default windows: 90 days for doctors and hospitals, 28 for pharmacies (§ 18 Abs. 6). */
export const DEFAULT_DAYS: Record<Role, number> = { doctor: 90, hospital: 90, pharmacy: 28 };

/** The vaccination record allows 28 days for every provider (§ 24f Abs. 2). */
export const VACCINATION_DAYS = 28;

/** Contact confirmations are deleted after 365 days (e-card ELGA FAQ 2.2.11.1). */
export const CONTACT_RETENTION_DAYS = 365;

/** Longest individual period a patient can grant (§ 18 Abs. 7). */
export const MAX_TRUSTED_DAYS = 365;

/** What each provider type may see by default (§ 21 Abs. 2, § 24f Abs. 2 with § 2 Z 18). */
export const ROLE_SCOPE: Record<Role, readonly DataKind[]> = {
  doctor: ['documents', 'medication', 'vaccinations'],
  hospital: ['documents', 'medication', 'vaccinations'],
  pharmacy: ['medication', 'vaccinations'],
};

/** Which individual periods a patient may set for a provider type. */
export function allowedProviderDays(role: Role): { min: number; max: number } {
  // § 18 Abs. 7 allows extension for lit. a, b, c and e; hospitals (lit. d) can only be shortened.
  return { min: 0, max: role === 'hospital' ? DEFAULT_DAYS.hospital : MAX_TRUSTED_DAYS };
}

export function validateProviderDays(role: Role, days: number): void {
  const { min, max } = allowedProviderDays(role);
  if (!Number.isInteger(days) || days < min || days > max) {
    throw new RangeError(`Access period for a ${role} must be a whole number of days from ${min} to ${max}.`);
  }
}

/** The window in days that applies to this provider and record type. */
export function windowDays(role: Role, providerId: string, kind: DataKind, settings: PatientSettings): number {
  if (kind === 'vaccinations') return VACCINATION_DAYS; // no blocking or extension for the vaccination record
  return settings.providerDays[providerId] ?? DEFAULT_DAYS[role];
}

/** The latest contact this provider recorded for the patient at or before `now`. */
export function latestContact(contacts: readonly Contact[], providerId: string, now: Date): Contact | undefined {
  let best: Contact | undefined;
  for (const c of contacts) {
    if (c.providerId !== providerId) continue;
    const t = Date.parse(c.at);
    if (t > now.getTime()) continue;
    if (!best || t > Date.parse(best.at)) best = c;
  }
  return best;
}

export interface DecideInput {
  role: Role;
  providerId: string;
  kind: DataKind;
  contacts: readonly Contact[];
  settings: PatientSettings;
  now: Date;
}

/**
 * Whether this provider may read this record type now.
 *
 * A window of N days ends exactly N x 24 hours after the contact: access at that instant is
 * refused. The law says the identity check must "not lie further back than" N days; reading
 * that as N x 24 hours is the sandbox's assumption and is labelled as such in the interface.
 */
export function decide({ role, providerId, kind, contacts, settings, now }: DecideInput): Decision {
  if (!ROLE_SCOPE[role].includes(kind)) {
    return { outcome: 'denied', reason: 'not-for-role', kind, source: 'gtelg21_2' };
  }
  if (kind !== 'vaccinations' && settings.optOut[kind]) {
    return { outcome: 'denied', reason: 'opted-out', kind, source: 'gtelg15' };
  }
  const contact = latestContact(contacts, providerId, now);
  if (!contact || now.getTime() - Date.parse(contact.at) >= CONTACT_RETENTION_DAYS * DAY_MS) {
    return { outcome: 'denied', reason: 'no-contact', kind, source: 'ecardFaq' };
  }
  const days = windowDays(role, providerId, kind, settings);
  if (days === 0) {
    return { outcome: 'denied', reason: 'blocked', kind, days, contact, source: 'gtelg16' };
  }
  const source: SourceId = kind === 'vaccinations' ? 'gtelg24f_2' : days > DEFAULT_DAYS[role] ? 'gtelg18_7' : 'gtelg18_6';
  const until = new Date(Date.parse(contact.at) + days * DAY_MS);
  if (now.getTime() >= until.getTime()) {
    return { outcome: 'expired', reason: 'expired', kind, days, contact, until: until.toISOString(), source };
  }
  return { outcome: 'granted', reason: 'within-window', kind, days, contact, until: until.toISOString(), source };
}

/** All three record types at once, for the banner and the contact confirmation panel. */
export function decideAll(input: Omit<DecideInput, 'kind'>): Record<DataKind, Decision> {
  return {
    documents: decide({ ...input, kind: 'documents' }),
    medication: decide({ ...input, kind: 'medication' }),
    vaccinations: decide({ ...input, kind: 'vaccinations' }),
  };
}

/** Whether a document from this treatment case may be stored (§ 16 Abs. 2 Z 2, § 15 Abs. 4). */
export function decideStore(kind: DataKind, contact: Contact | undefined, settings: PatientSettings): Decision {
  if (!contact) return { outcome: 'denied', reason: 'no-contact', kind, source: 'ecardFaq' };
  if (contact.objection) return { outcome: 'denied', reason: 'objection', kind, contact, source: 'gtelg16' };
  if (kind !== 'vaccinations' && settings.optOut[kind]) return { outcome: 'denied', reason: 'opted-out', kind, contact, source: 'gtelg15' };
  return { outcome: 'granted', reason: 'within-window', kind, contact, source: 'gtelg16' };
}

/** One plain sentence for each reason, used in the interface and the audit log. */
export function explain(d: Decision): string {
  switch (d.reason) {
    case 'within-window':
      return `Within the ${d.days}-day window after the e-card was inserted.`;
    case 'expired':
      return `The ${d.days}-day window after the e-card was inserted has ended. Insert the e-card again to renew access.`;
    case 'no-contact':
      return 'No contact confirmation from this provider for this patient. Insert the e-card to request access.';
    case 'blocked':
      return "The patient has set this provider's access period to 0 days.";
    case 'opted-out':
      return `The patient has opted out of ${d.kind === 'documents' ? 'documents' : 'medication'} in the health record.`;
    case 'not-for-role':
      return 'Pharmacies may see medication data only.';
    case 'objection':
      return 'The patient objected to storing data from this treatment case.';
  }
}

export function sourceOf(d: Decision) {
  return SOURCES[d.source];
}
