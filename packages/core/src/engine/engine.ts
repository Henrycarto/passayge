// The sandbox engine: it plays the parts of ELGA's access control facade, token service and
// contact confirmation service in one simplified service, in front of a FHIR server.
// It has no transport of its own: the gateway serves it over HTTP in front of HAPI, and the
// browser demo calls it directly with an in-memory FHIR store. Both use the same routes below.

import type { AuditEvent, Bundle, DocumentReference } from 'fhir/r4';
import { fromAuditEvent, toAuditEvent, type AuditRecord } from '../audit';
import { RECORD_KIND_SYSTEM } from '../fhir';
import { DATA_KINDS, allowedProviderDays, decide, decideAll, explain, validateProviderDays, type Contact, type DataKind, type Decision, type PatientSettings } from '../rules';
import { CONTACTS, PATIENTS, PROVIDERS, SETTINGS, SIM_START, TIME_ZONE, type Provider } from '../seed';
import { SOURCES } from '../sources';
import { SYNTHETIC_SVNR_SYSTEM } from '../svnr';
import { SimClock } from './clock';
import type { FhirClient } from './fhir-client';
import { NetLog } from './netlog';
import { clearSessionAudit } from './seed-fhir';

export class State {
  contacts: Contact[] = [];
  settings: Record<string, PatientSettings> = {};
  actorId = 'prov-aigner';
  private nextContact = 1;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.contacts = structuredClone(CONTACTS);
    this.settings = structuredClone(SETTINGS);
    this.actorId = 'prov-aigner';
    this.nextContact = 1;
  }

  actor(): Provider {
    return PROVIDERS.find((p) => p.id === this.actorId)!;
  }

  settingsFor(patientId: string): PatientSettings {
    return (this.settings[patientId] ??= { optOut: { documents: false, medication: false }, providerDays: {} });
  }

  contactsFor(patientId: string): Contact[] {
    return this.contacts.filter((c) => c.patientId === patientId);
  }

  addContact(patientId: string, providerId: string, at: string, objection: boolean): Contact {
    const c: Contact = { id: `kb-s${this.nextContact++}`, patientId, providerId, at, ...(objection ? { objection } : {}) };
    this.contacts.push(c);
    return c;
  }
}

export interface EngineRequest {
  method: string;
  /** Path and query, e.g. "/fhir/Patient?family=brandst". */
  url: string;
  body?: unknown;
}

export interface EngineResponse {
  status: number;
  type: string;
  body: string;
}

const KIND_LABEL: Record<DataKind, string> = { documents: 'documents', medication: 'medication', vaccinations: 'vaccination record' };
const PDQ_PARAMS = ['family', 'given', 'birthdate', 'identifier', 'name', 'gender'] as const;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE }).format(new Date(iso));

export function publicDecision(d: Decision) {
  const src = SOURCES[d.source];
  return { ...d, explanation: explain(d), sourceLabel: src.label, sourceUrl: src.url };
}

function outcome(code: 'forbidden' | 'invalid' | 'not-found', diagnostics: string, decision?: Decision) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code, diagnostics }],
    ...(decision ? { extension: [{ url: 'https://henrycarto.com/passayge/fhir/StructureDefinition/access-decision', valueString: JSON.stringify(publicDecision(decision)) }] } : {}),
  };
}

const json = (status: number, body: unknown): EngineResponse => ({ status, type: 'application/json', body: JSON.stringify(body) });
const fhir = (status: number, body: string): EngineResponse => ({ status, type: 'application/fhir+json', body });

export interface EngineOptions {
  fhir: FhirClient;
  clock?: SimClock;
  netlog?: NetLog;
  /** Called when an audit record could not be written. */
  onAuditError?: (status: number, body: string) => void;
}

export class Engine {
  readonly state = new State();
  readonly clock: SimClock;
  readonly netlog: NetLog;
  readonly fhir: FhirClient;
  private readonly onAuditError?: (status: number, body: string) => void;

  constructor(opts: EngineOptions) {
    this.fhir = opts.fhir;
    this.clock = opts.clock ?? new SimClock(SIM_START);
    this.netlog = opts.netlog ?? new NetLog();
    this.onAuditError = opts.onAuditError;
  }

  private newAction(): string {
    return globalThis.crypto.randomUUID().slice(0, 13);
  }

  private logAccess(action: string, d: Decision, path: string): void {
    this.netlog.add({
      action,
      at: this.clock.now().toISOString(),
      transaction: 'access',
      method: 'POST',
      path,
      status: d.outcome === 'granted' ? 200 : 403,
      ms: 0,
      note: `${d.outcome === 'granted' ? 'Granted' : d.outcome === 'expired' ? 'Expired' : 'Denied'}: ${explain(d)} ${SOURCES[d.source].label}.`,
    });
  }

  private async writeAudit(action: string, r: Omit<AuditRecord, 'at' | 'transactionNumber'>): Promise<void> {
    const record: AuditRecord = { ...r, at: this.clock.now().toISOString(), transactionNumber: action };
    const res = await this.fhir.call('ITI-20', action, 'POST', 'AuditEvent', { body: toAuditEvent(record) });
    if (res.status >= 300) this.onAuditError?.(res.status, res.body);
  }

  private actorFields() {
    const p = this.state.actor();
    return { providerId: p.id, organisation: p.organisation, person: p.person, personRef: `${p.id}-person`, role: p.role };
  }

  private decideFor(patientId: string, kind: DataKind): Decision {
    const p = this.state.actor();
    return decide({ role: p.role, providerId: p.id, kind, contacts: this.state.contactsFor(patientId), settings: this.state.settingsFor(patientId), now: this.clock.now() });
  }

  private knownPatient(id: string): boolean {
    return PATIENTS.some((p) => p.id === id);
  }

  /** One request, routed the same way for the gateway and the browser demo. */
  async handle(req: EngineRequest): Promise<EngineResponse> {
    const u = new URL(req.url, 'http://sandbox.local');
    const q = u.searchParams;
    const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const m = req.method.toUpperCase();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const route = `${m} /${parts.slice(0, 2).join('/')}`;

    if (parts[0] === 'api') {
      if (route === 'GET /api/health') return json(200, { ok: true });
      if (route === 'GET /api/session') return json(200, this.session());
      if (m === 'POST' && u.pathname === '/api/session/actor') return this.setActor(body.providerId as string | undefined);
      if (route === 'POST /api/clock') return this.moveClock(body);
      if (route === 'POST /api/reset') return this.reset();
      if (route === 'GET /api/access' && parts[2]) return this.access(parts[2]);
      if (route === 'POST /api/contacts') return this.insertCard(body.patientId as string | undefined, body.objection === true);
      if (route === 'PUT /api/settings' && parts[2]) return this.saveSettings(parts[2], body as Partial<PatientSettings>);
      if (route === 'GET /api/audit') return this.audit(q.get('patient') ?? '');
      if (route === 'GET /api/network') return json(200, { entries: parts[2] ? this.netlog.forAction(parts[2]) : this.netlog.since(Number(q.get('after') ?? 0)) });
    }
    if (parts[0] === 'fhir') {
      if (route === 'GET /fhir/Patient') return parts[2] ? this.readPatient(parts[2]) : this.searchPatients(q);
      if (route === 'GET /fhir/DocumentReference' && !parts[2]) return this.findDocuments(q.get('patient') ?? '', q.get('category') ?? '');
      if (route === 'GET /fhir/Binary' && parts[2]) return this.retrieve(parts[2]);
    }
    return json(404, outcome('not-found', 'Not found.'));
  }

  // ---------------------------------------------------------------------------------------------
  // Session, clock and reset

  private session() {
    return { actor: this.state.actor(), providers: PROVIDERS, now: this.clock.now().toISOString(), simStart: SIM_START, timeZone: TIME_ZONE };
  }

  private setActor(providerId: string | undefined): EngineResponse {
    const p = PROVIDERS.find((x) => x.id === providerId);
    if (!p) return json(400, outcome('invalid', 'Unknown provider.'));
    this.state.actorId = p.id;
    return json(200, { actor: p });
  }

  private moveClock(b: { days?: unknown; hours?: unknown; to?: unknown; reset?: unknown }): EngineResponse {
    const before = this.clock.now();
    try {
      if (b.reset) this.clock.reset();
      else if (typeof b.to === 'string') this.clock.set(b.to);
      else this.clock.advance(((Number(b.days ?? 0) || 0) * 24 + (Number(b.hours ?? 0) || 0)) * 3_600_000);
    } catch (e) {
      return json(400, outcome('invalid', (e as Error).message));
    }
    this.netlog.add({
      action: this.newAction(), at: this.clock.now().toISOString(), transaction: 'clock', method: 'POST', path: '/api/clock', status: 200, ms: 0,
      note: b.reset ? 'Clock reset to the start.' : `Moved from ${before.toISOString()} to ${this.clock.now().toISOString()}.`,
    });
    return json(200, { now: this.clock.now().toISOString() });
  }

  private async reset(): Promise<EngineResponse> {
    await clearSessionAudit(this.fhir);
    this.state.reset();
    this.clock.reset();
    this.netlog.clear();
    return json(200, { now: this.clock.now().toISOString() });
  }

  // ---------------------------------------------------------------------------------------------
  // PDQm: Mobile Patient Demographics Query [ITI-78]

  private async searchPatients(query: URLSearchParams): Promise<EngineResponse> {
    const q = new URLSearchParams();
    for (const k of PDQ_PARAMS) {
      const v = query.get(k)?.trim();
      if (!v) continue;
      if (k === 'identifier') q.set(k, v.includes('|') ? v : `${SYNTHETIC_SVNR_SYSTEM}|${v.replace(/\s/g, '')}`);
      else q.set(k, v);
    }
    if ([...q.keys()].length === 0) return json(400, outcome('invalid', 'Search by name, date of birth or social security number.'));
    q.set('_count', '20');
    const r = await this.fhir.call('ITI-78', this.newAction(), 'GET', `Patient?${q}`);
    return fhir(r.status, r.body);
  }

  private async readPatient(id: string): Promise<EngineResponse> {
    const r = await this.fhir.call('ITI-78', this.newAction(), 'GET', `Patient/${encodeURIComponent(id)}`);
    return fhir(r.status, r.body);
  }

  // ---------------------------------------------------------------------------------------------
  // Access status (sandbox only), contact confirmation and the (simulated) access portal

  private access(patientId: string): EngineResponse {
    if (!this.knownPatient(patientId)) return json(404, outcome('not-found', 'No such patient in the sandbox.'));
    const p = this.state.actor();
    const now = this.clock.now();
    const decisions = decideAll({ role: p.role, providerId: p.id, contacts: this.state.contactsFor(patientId), settings: this.state.settingsFor(patientId), now });
    return json(200, {
      now: now.toISOString(),
      actor: p,
      decisions: Object.fromEntries(DATA_KINDS.map((k) => [k, publicDecision(decisions[k])])),
      settings: this.state.settingsFor(patientId),
      allowedDays: allowedProviderDays(p.role),
    });
  }

  private async insertCard(patientId: string | undefined, objection: boolean): Promise<EngineResponse> {
    if (!patientId || !this.knownPatient(patientId)) return json(400, outcome('invalid', 'Choose a patient first.'));
    const action = this.newAction();
    const p = this.state.actor();
    const c = this.state.addContact(patientId, p.id, this.clock.now().toISOString(), objection);
    this.netlog.add({
      action, at: c.at, transaction: 'contact', method: 'POST', path: '/api/contacts', status: 201, ms: 0,
      note: `Contact confirmation for ${p.organisation}${c.objection ? ', with an objection for this treatment case' : ''}.`,
      excerpt: JSON.stringify(c, null, 2),
    });
    await this.writeAudit(action, {
      processing: 'contact', description: 'Recorded contact confirmation', dataLabel: 'e-card, simulated', outcome: 'recorded',
      explanation: `Contact confirmation from the e-card.${c.objection ? ' The patient objected to storing data from this treatment case.' : ''}`,
      source: 'gtelg18_6', patientId, ...this.actorFields(),
    });
    return json(201, { contact: c });
  }

  private async saveSettings(patientId: string, body: Partial<PatientSettings>): Promise<EngineResponse> {
    if (!this.knownPatient(patientId)) return json(404, outcome('not-found', 'No such patient in the sandbox.'));
    const next: PatientSettings = structuredClone(this.state.settingsFor(patientId));
    if (body.optOut) next.optOut = { documents: !!body.optOut.documents, medication: !!body.optOut.medication };
    if (body.providerDays) {
      for (const [providerId, days] of Object.entries(body.providerDays as Record<string, number | null>)) {
        const prov = PROVIDERS.find((x) => x.id === providerId);
        if (!prov) return json(400, outcome('invalid', `Unknown provider ${providerId}.`));
        if (days === null) {
          delete next.providerDays[providerId];
          continue;
        }
        try {
          validateProviderDays(prov.role, days);
        } catch (e) {
          return json(400, outcome('invalid', (e as Error).message));
        }
        next.providerDays[providerId] = days;
      }
    }
    this.state.settings[patientId] = next;
    await this.writeAudit(this.newAction(), {
      processing: 'settings', description: 'Changed access settings', dataLabel: 'Access portal (simulated)', outcome: 'recorded',
      explanation: 'The patient changed opt-outs or access periods.', source: 'gtelg16', patientId,
      providerId: '', organisation: 'Access portal (simulated)', person: 'The patient', role: 'patient',
    });
    return json(200, { settings: next });
  }

  // ---------------------------------------------------------------------------------------------
  // MHD: Find Document References [ITI-67] and Retrieve Document [ITI-68]

  private async findDocuments(patient: string, category: string): Promise<EngineResponse> {
    const patientId = patient.replace(/^Patient\//, '');
    const kind = category as DataKind;
    if (!this.knownPatient(patientId) || !DATA_KINDS.includes(kind)) {
      return json(400, outcome('invalid', 'Give a patient and a category: documents, medication or vaccinations.'));
    }
    const action = this.newAction();
    const d = this.decideFor(patientId, kind);
    this.logAccess(action, d, `/access/decide?kind=${kind}`);
    const base = { processing: 'search' as const, description: `Searched ${KIND_LABEL[kind]}`, query: `patient=Patient/${patientId}&category=${kind}`, kind, patientId, ...this.actorFields() };
    if (d.outcome !== 'granted') {
      await this.writeAudit(action, { ...base, dataLabel: capital(KIND_LABEL[kind]), outcome: d.outcome, reason: d.reason, explanation: explain(d), source: d.source });
      return json(403, outcome('forbidden', explain(d), d));
    }
    const r = await this.fhir.call('ITI-67', action, 'GET', `DocumentReference?patient=Patient/${patientId}&category=${encodeURIComponent(`${RECORD_KIND_SYSTEM}|${kind}`)}&_sort=-date&_count=100`);
    const n = (JSON.parse(r.body) as Bundle).entry?.length ?? 0;
    await this.writeAudit(action, { ...base, dataLabel: `${n} found`, outcome: 'granted', reason: d.reason, explanation: explain(d), source: d.source });
    return fhir(r.status, r.body);
  }

  private async retrieve(binaryId: string): Promise<EngineResponse> {
    const docId = binaryId.replace(/-content$/, '');
    const action = this.newAction();
    // Like ELGA's facade, the access check may need the document's registry entry first.
    const meta = await this.fhir.call('access', action, 'GET', `DocumentReference/${encodeURIComponent(docId)}`, { note: "Reads the document's registry entry to apply the rules." });
    if (meta.status !== 200) return json(404, outcome('not-found', 'No such document.'));
    const ref = JSON.parse(meta.body) as DocumentReference;
    const patientId = ref.subject?.reference?.replace('Patient/', '') ?? '';
    const kind = (ref.category?.[0]?.coding?.find((c) => c.system === RECORD_KIND_SYSTEM)?.code ?? 'documents') as DataKind;
    const d = this.decideFor(patientId, kind);
    this.logAccess(action, d, `/access/decide?kind=${kind}`);
    const label = `${ref.type?.text ?? 'Document'}, ${ref.date ? fmtDay(ref.date) : 'undated'}`;
    const base = { processing: 'read' as const, description: kind === 'documents' ? 'Opened document' : `Opened ${KIND_LABEL[kind]}`, dataLabel: label, dataRef: `DocumentReference/${docId}`, kind, patientId, ...this.actorFields() };
    if (d.outcome !== 'granted') {
      await this.writeAudit(action, { ...base, outcome: d.outcome, reason: d.reason, explanation: explain(d), source: d.source });
      return json(403, outcome('forbidden', explain(d), d));
    }
    const r = await this.fhir.call('ITI-68', action, 'GET', `Binary/${encodeURIComponent(binaryId)}`, { accept: 'text/xml' });
    await this.writeAudit(action, { ...base, outcome: 'granted', reason: d.reason, explanation: explain(d), source: d.source });
    return { status: r.status, type: 'text/xml; charset=utf-8', body: r.body };
  }

  // ---------------------------------------------------------------------------------------------
  // Retrieve ATNA Audit Event [ITI-81]

  private async audit(patient: string): Promise<EngineResponse> {
    const patientId = patient.replace(/^Patient\//, '');
    if (!this.knownPatient(patientId)) return json(400, outcome('invalid', 'Choose a patient to see their audit log.'));
    const r = await this.fhir.call('ITI-81', this.newAction(), 'GET', `AuditEvent?entity=Patient/${patientId}&_sort=-date&_count=200`);
    const bundle = JSON.parse(r.body) as Bundle;
    const records = (bundle.entry ?? []).map((e) => fromAuditEvent(e.resource as AuditEvent)).filter(Boolean);
    return json(200, { records });
  }
}
