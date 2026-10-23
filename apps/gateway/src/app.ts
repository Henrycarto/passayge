// The sandbox gateway. It plays the parts of ELGA's access control facade, token service and
// contact confirmation service in one simplified service, in front of a HAPI FHIR server.
// The browser only ever talks to this gateway.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Bundle, DocumentReference } from 'fhir/r4';
import {
  CONTACTS, DATA_KINDS, PATIENTS, PROVIDERS, RECORD_KIND_SYSTEM, SETTINGS, SIM_START, SOURCES, SYNTHETIC_SVNR_SYSTEM, TIME_ZONE,
  allowedProviderDays, decide, decideAll, explain, fromAuditEvent, toAuditEvent, validateProviderDays,
  type AuditRecord, type Contact, type DataKind, type Decision, type PatientSettings, type Provider,
} from '@passayge/core';
import { SimClock } from './clock';
import { guardedFetch, type Fetch } from './egress';
import { Hapi } from './hapi';
import { NetLog } from './netlog';
import { clearSessionAudit } from './seed';

export interface AppOptions {
  hapiBase: string;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: Fetch;
  clock?: SimClock;
  webDist?: string;
  logger?: boolean;
}

export interface Sandbox {
  app: FastifyInstance;
  clock: SimClock;
  netlog: NetLog;
  hapi: Hapi;
  state: State;
}

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

const KIND_LABEL: Record<DataKind, string> = { documents: 'documents', medication: 'medication', vaccinations: 'vaccination record' };

function outcome(code: 'forbidden' | 'invalid' | 'not-found', diagnostics: string, decision?: Decision) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code, diagnostics }],
    ...(decision ? { extension: [{ url: 'https://henrycarto.com/passayge/fhir/StructureDefinition/access-decision', valueString: JSON.stringify(publicDecision(decision)) }] } : {}),
  };
}

export function publicDecision(d: Decision) {
  const src = SOURCES[d.source];
  return { ...d, explanation: explain(d), sourceLabel: src.label, sourceUrl: src.url };
}

const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE }).format(new Date(iso));

export function buildApp(opts: AppOptions): Sandbox {
  const clock = opts.clock ?? new SimClock(SIM_START);
  const netlog = new NetLog();
  const fetcher = guardedFetch([opts.hapiBase], opts.fetch);
  const hapi = new Hapi(opts.hapiBase, fetcher, netlog, clock);
  const state = new State();
  const app = Fastify({ logger: opts.logger ?? false });

  const newAction = () => randomUUID().slice(0, 13);

  const logAccess = (action: string, d: Decision, path: string) =>
    netlog.add({
      action,
      at: clock.now().toISOString(),
      transaction: 'access',
      method: 'POST',
      path,
      status: d.outcome === 'granted' ? 200 : 403,
      ms: 0,
      note: `${d.outcome === 'granted' ? 'Granted' : d.outcome === 'expired' ? 'Expired' : 'Denied'}: ${explain(d)} ${SOURCES[d.source].label}.`,
    });

  async function writeAudit(action: string, r: Omit<AuditRecord, 'at' | 'transactionNumber'>): Promise<void> {
    const record: AuditRecord = { ...r, at: clock.now().toISOString(), transactionNumber: action };
    const res = await hapi.call('ITI-20', action, 'POST', 'AuditEvent', { body: toAuditEvent(record) });
    if (res.status >= 300) app.log.error({ status: res.status, body: res.body }, 'audit write failed');
  }

  const actorFields = () => {
    const p = state.actor();
    return { providerId: p.id, organisation: p.organisation, person: p.person, personRef: `${p.id}-person`, role: p.role };
  };

  const decideFor = (patientId: string, kind: DataKind) => {
    const p = state.actor();
    return decide({ role: p.role, providerId: p.id, kind, contacts: state.contactsFor(patientId), settings: state.settingsFor(patientId), now: clock.now() });
  };

  const knownPatient = (id: string) => PATIENTS.some((p) => p.id === id);

  // ---------------------------------------------------------------------------------------------
  // Session, clock and reset

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/session', async () => ({
    actor: state.actor(),
    providers: PROVIDERS,
    now: clock.now().toISOString(),
    simStart: SIM_START,
    timeZone: TIME_ZONE,
  }));

  app.post<{ Body: { providerId?: string } }>('/api/session/actor', async (req, reply) => {
    const p = PROVIDERS.find((x) => x.id === req.body?.providerId);
    if (!p) return reply.code(400).send(outcome('invalid', 'Unknown provider.'));
    state.actorId = p.id;
    return { actor: p };
  });

  app.post<{ Body: { days?: number; hours?: number; to?: string; reset?: boolean } }>('/api/clock', async (req, reply) => {
    const b = req.body ?? {};
    const before = clock.now();
    try {
      if (b.reset) clock.reset();
      else if (b.to) clock.set(b.to);
      else clock.advance(((b.days ?? 0) * 24 + (b.hours ?? 0)) * 3_600_000);
    } catch (e) {
      return reply.code(400).send(outcome('invalid', (e as Error).message));
    }
    netlog.add({
      action: newAction(), at: clock.now().toISOString(), transaction: 'clock', method: 'POST', path: '/api/clock', status: 200, ms: 0,
      note: b.reset ? 'Clock reset to the start.' : `Moved from ${before.toISOString()} to ${clock.now().toISOString()}.`,
    });
    return { now: clock.now().toISOString() };
  });

  app.post('/api/reset', async () => {
    await clearSessionAudit(hapi);
    state.reset();
    clock.reset();
    netlog.clear();
    return { now: clock.now().toISOString() };
  });

  // ---------------------------------------------------------------------------------------------
  // PDQm: Mobile Patient Demographics Query [ITI-78]

  const PDQ_PARAMS = ['family', 'given', 'birthdate', 'identifier', 'name', 'gender'] as const;

  app.get<{ Querystring: Record<string, string> }>('/fhir/Patient', async (req, reply) => {
    const q = new URLSearchParams();
    for (const k of PDQ_PARAMS) {
      const v = req.query[k]?.trim();
      if (!v) continue;
      if (k === 'identifier') q.set(k, v.includes('|') ? v : `${SYNTHETIC_SVNR_SYSTEM}|${v.replace(/\s/g, '')}`);
      else q.set(k, v);
    }
    if ([...q.keys()].length === 0) return reply.code(400).send(outcome('invalid', 'Search by name, date of birth or social security number.'));
    q.set('_count', '20');
    const action = newAction();
    const r = await hapi.call('ITI-78', action, 'GET', `Patient?${q}`);
    return reply.code(r.status).type('application/fhir+json').send(r.body);
  });

  app.get<{ Params: { id: string } }>('/fhir/Patient/:id', async (req, reply) => {
    const r = await hapi.call('ITI-78', newAction(), 'GET', `Patient/${encodeURIComponent(req.params.id)}`);
    return reply.code(r.status).type('application/fhir+json').send(r.body);
  });

  // ---------------------------------------------------------------------------------------------
  // Access status (sandbox only) and contact confirmation

  app.get<{ Params: { patientId: string } }>('/api/access/:patientId', async (req, reply) => {
    const { patientId } = req.params;
    if (!knownPatient(patientId)) return reply.code(404).send(outcome('not-found', 'No such patient in the sandbox.'));
    const p = state.actor();
    const now = clock.now();
    const decisions = decideAll({ role: p.role, providerId: p.id, contacts: state.contactsFor(patientId), settings: state.settingsFor(patientId), now });
    return {
      now: now.toISOString(),
      actor: p,
      decisions: Object.fromEntries(DATA_KINDS.map((k) => [k, publicDecision(decisions[k])])),
      settings: state.settingsFor(patientId),
      allowedDays: allowedProviderDays(p.role),
    };
  });

  app.post<{ Body: { patientId?: string; objection?: boolean } }>('/api/contacts', async (req, reply) => {
    const patientId = req.body?.patientId ?? '';
    if (!knownPatient(patientId)) return reply.code(400).send(outcome('invalid', 'Choose a patient first.'));
    const action = newAction();
    const p = state.actor();
    const c = state.addContact(patientId, p.id, clock.now().toISOString(), req.body?.objection === true);
    netlog.add({
      action, at: c.at, transaction: 'contact', method: 'POST', path: '/api/contacts', status: 201, ms: 0,
      note: `Contact confirmation for ${p.organisation}${c.objection ? ', with an objection for this treatment case' : ''}.`,
      excerpt: JSON.stringify(c, null, 2),
    });
    await writeAudit(action, {
      processing: 'contact', description: 'Recorded contact confirmation', dataLabel: 'e-card, simulated', outcome: 'recorded',
      explanation: `Contact confirmation from the e-card.${c.objection ? ' The patient objected to storing data from this treatment case.' : ''}`,
      source: 'gtelg18_6', patientId, ...actorFields(),
    });
    return reply.code(201).send({ contact: c });
  });

  // The (simulated) access portal where patients set opt-outs and access periods.
  app.put<{ Params: { patientId: string }; Body: Partial<PatientSettings> }>('/api/settings/:patientId', async (req, reply) => {
    const { patientId } = req.params;
    if (!knownPatient(patientId)) return reply.code(404).send(outcome('not-found', 'No such patient in the sandbox.'));
    const next: PatientSettings = structuredClone(state.settingsFor(patientId));
    if (req.body?.optOut) next.optOut = { documents: !!req.body.optOut.documents, medication: !!req.body.optOut.medication };
    if (req.body?.providerDays) {
      for (const [providerId, days] of Object.entries(req.body.providerDays)) {
        const prov = PROVIDERS.find((x) => x.id === providerId);
        if (!prov) return reply.code(400).send(outcome('invalid', `Unknown provider ${providerId}.`));
        if (days === null) {
          delete next.providerDays[providerId];
          continue;
        }
        try {
          validateProviderDays(prov.role, days);
        } catch (e) {
          return reply.code(400).send(outcome('invalid', (e as Error).message));
        }
        next.providerDays[providerId] = days;
      }
    }
    state.settings[patientId] = next;
    const action = newAction();
    await writeAudit(action, {
      processing: 'settings', description: 'Changed access settings', dataLabel: 'Access portal (simulated)', outcome: 'recorded',
      explanation: 'The patient changed opt-outs or access periods.', source: 'gtelg16', patientId,
      providerId: '', organisation: 'Access portal (simulated)', person: 'The patient', role: 'patient',
    });
    return { settings: next };
  });

  // ---------------------------------------------------------------------------------------------
  // MHD: Find Document References [ITI-67]

  app.get<{ Querystring: { patient?: string; category?: string } }>('/fhir/DocumentReference', async (req, reply) => {
    const patientId = (req.query.patient ?? '').replace(/^Patient\//, '');
    const kind = req.query.category as DataKind | undefined;
    if (!knownPatient(patientId) || !kind || !DATA_KINDS.includes(kind)) {
      return reply.code(400).send(outcome('invalid', 'Give a patient and a category: documents, medication or vaccinations.'));
    }
    const action = newAction();
    const d = decideFor(patientId, kind);
    logAccess(action, d, `/access/decide?kind=${kind}`);
    const base = { processing: 'search' as const, description: `Searched ${KIND_LABEL[kind]}`, query: `patient=Patient/${patientId}&category=${kind}`, kind, patientId, ...actorFields() };
    if (d.outcome !== 'granted') {
      await writeAudit(action, { ...base, dataLabel: capital(KIND_LABEL[kind]), outcome: d.outcome, reason: d.reason, explanation: explain(d), source: d.source });
      return reply.code(403).send(outcome('forbidden', explain(d), d));
    }
    const r = await hapi.call('ITI-67', action, 'GET', `DocumentReference?patient=Patient/${patientId}&category=${encodeURIComponent(`${RECORD_KIND_SYSTEM}|${kind}`)}&_sort=-date&_count=100`);
    const bundle = JSON.parse(r.body) as Bundle;
    const n = bundle.entry?.length ?? 0;
    await writeAudit(action, { ...base, dataLabel: `${n} found`, outcome: 'granted', reason: d.reason, explanation: explain(d), source: d.source });
    return reply.code(r.status).type('application/fhir+json').send(r.body);
  });

  // ---------------------------------------------------------------------------------------------
  // MHD: Retrieve Document [ITI-68]

  app.get<{ Params: { id: string } }>('/fhir/Binary/:id', async (req, reply) => {
    const binaryId = req.params.id;
    const docId = binaryId.replace(/-content$/, '');
    const action = newAction();
    // Like ELGA's facade, the access check may need the document's registry entry first.
    const meta = await hapi.call('access', action, 'GET', `DocumentReference/${encodeURIComponent(docId)}`, { note: "Reads the document's registry entry to apply the rules." });
    if (meta.status !== 200) return reply.code(404).send(outcome('not-found', 'No such document.'));
    const ref = JSON.parse(meta.body) as DocumentReference;
    const patientId = ref.subject?.reference?.replace('Patient/', '') ?? '';
    const kind = (ref.category?.[0]?.coding?.find((c) => c.system === RECORD_KIND_SYSTEM)?.code ?? 'documents') as DataKind;
    const d = decideFor(patientId, kind);
    logAccess(action, d, `/access/decide?kind=${kind}`);
    const label = `${ref.type?.text ?? 'Document'}, ${ref.date ? fmtDay(ref.date) : 'undated'}`;
    const base = { processing: 'read' as const, description: kind === 'documents' ? 'Opened document' : `Opened ${KIND_LABEL[kind]}`, dataLabel: label, dataRef: `DocumentReference/${docId}`, kind, patientId, ...actorFields() };
    if (d.outcome !== 'granted') {
      await writeAudit(action, { ...base, outcome: d.outcome, reason: d.reason, explanation: explain(d), source: d.source });
      return reply.code(403).send(outcome('forbidden', explain(d), d));
    }
    const r = await hapi.call('ITI-68', action, 'GET', `Binary/${encodeURIComponent(binaryId)}`, { accept: 'text/xml' });
    await writeAudit(action, { ...base, outcome: 'granted', reason: d.reason, explanation: explain(d), source: d.source });
    return reply.code(r.status).type('text/xml; charset=utf-8').send(r.body);
  });

  // ---------------------------------------------------------------------------------------------
  // Audit log [ITI-81] and network log

  app.get<{ Querystring: { patient?: string } }>('/api/audit', async (req, reply) => {
    const patientId = (req.query.patient ?? '').replace(/^Patient\//, '');
    if (!knownPatient(patientId)) return reply.code(400).send(outcome('invalid', 'Choose a patient to see their audit log.'));
    const r = await hapi.call('ITI-81', newAction(), 'GET', `AuditEvent?entity=Patient/${patientId}&_sort=-date&_count=200`);
    const bundle = JSON.parse(r.body) as Bundle;
    const records = (bundle.entry ?? []).map((e) => fromAuditEvent(e.resource as Parameters<typeof fromAuditEvent>[0])).filter(Boolean);
    return { records };
  });

  app.get<{ Querystring: { after?: string } }>('/api/network', async (req) => ({ entries: netlog.since(Number(req.query.after ?? 0)) }));

  app.get<{ Params: { action: string } }>('/api/network/:action', async (req) => ({ entries: netlog.forAction(req.params.action) }));

  // ---------------------------------------------------------------------------------------------
  // The built web client, if present

  if (opts.webDist && existsSync(opts.webDist)) {
    app.register(fastifyStatic, { root: opts.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply: FastifyReply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/fhir')) return reply.code(404).send(outcome('not-found', 'Not found.'));
      return reply.sendFile('index.html');
    });
  }

  return { app, clock, netlog, hapi, state };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

