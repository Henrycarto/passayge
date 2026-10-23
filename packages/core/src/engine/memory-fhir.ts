// An in-memory FHIR store for the browser demo: just the searches and writes the engine uses
// (PDQm, MHD, AuditEvent), with no profile validation. The full stack uses HAPI FHIR instead.

import type { AuditEvent, Bundle, DocumentReference, Patient, Resource } from 'fhir/r4';
import type { TransactionId } from '../ihe';
import type { SimClock } from './clock';
import { logCall, type CallOptions, type FhirClient, type FhirResponse } from './fhir-client';
import type { NetLog } from './netlog';

type Stored = Resource & { id?: string };

const fhirJson = (status: number, body: unknown): FhirResponse => ({ status, body: JSON.stringify(body), contentType: 'application/fhir+json' });
const searchset = (rs: Resource[]): Bundle => ({ resourceType: 'Bundle', type: 'searchset', total: rs.length, entry: rs.map((resource) => ({ resource })) });

function decodeBase64(data: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
}

const lower = (s: string | undefined) => (s ?? '').toLocaleLowerCase('de-AT');

export class MemoryFhir implements FhirClient {
  readonly store = new Map<string, Stored>();
  private nextId = 1;

  constructor(
    private readonly log: NetLog,
    private readonly clock: SimClock,
  ) {}

  async call(transaction: TransactionId, action: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: CallOptions = {}): Promise<FhirResponse> {
    const started = performance.now();
    const at = this.clock.now().toISOString();
    const res = this.respond(method, path, opts);
    logCall(this.log, { transaction, action, method, path, status: res.status, ms: Math.round(performance.now() - started), at, body: res.body }, opts);
    return res;
  }

  private all<T extends Resource>(type: string): T[] {
    return [...this.store.values()].filter((r) => r.resourceType === type) as unknown as T[];
  }

  private respond(method: string, path: string, opts: CallOptions): FhirResponse {
    const u = new URL(path, 'http://memory.local/');
    const q = u.searchParams;
    const [type, id] = u.pathname.replace(/^\//, '').split('/') as [string, string | undefined];

    if (method === 'POST' && type === '') {
      for (const e of (opts.body as Bundle).entry ?? []) this.store.set(e.request!.url, e.resource as Stored);
      return fhirJson(200, { resourceType: 'Bundle', type: 'transaction-response' });
    }
    if (method === 'POST' && type === 'AuditEvent') {
      const created = { ...(opts.body as AuditEvent), id: `mem-${this.nextId++}` };
      this.store.set(`AuditEvent/${created.id}`, created);
      return fhirJson(201, created);
    }
    if (method === 'DELETE' && type === 'AuditEvent' && !id) {
      const [system, code] = (q.get('_tag') ?? '').split('|');
      for (const [k, r] of this.store) if (r.resourceType === 'AuditEvent' && r.meta?.tag?.some((t) => t.system === system && t.code === code)) this.store.delete(k);
      return fhirJson(200, { resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'informational' }] });
    }
    if (method !== 'GET') return fhirJson(405, { resourceType: 'OperationOutcome' });
    if (type === 'metadata') return fhirJson(200, { resourceType: 'CapabilityStatement', status: 'active' });

    if (id) {
      const r = this.store.get(`${type}/${id}`);
      if (!r) return fhirJson(404, { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] });
      if (type === 'Binary' && opts.accept && !opts.accept.includes('fhir')) {
        const b = r as { data?: string; contentType?: string };
        return { status: 200, body: decodeBase64(b.data ?? ''), contentType: b.contentType ?? 'text/xml' };
      }
      return fhirJson(200, r);
    }

    const count = Number(q.get('_count') ?? 100);
    if (type === 'Patient') {
      const family = lower(q.get('family') ?? undefined);
      const given = lower(q.get('given') ?? undefined);
      const birthdate = q.get('birthdate');
      const identifier = q.get('identifier');
      const hits = this.all<Patient>('Patient').filter((p) => {
        if (family && !p.name?.some((n) => lower(n.family).startsWith(family))) return false;
        if (given && !p.name?.some((n) => n.given?.some((g) => lower(g).startsWith(given)))) return false;
        if (birthdate && p.birthDate !== birthdate) return false;
        if (identifier && !p.identifier?.some((i) => `${i.system}|${i.value}` === identifier)) return false;
        return true;
      });
      return fhirJson(200, searchset(hits.slice(0, count)));
    }
    if (type === 'DocumentReference') {
      const patient = q.get('patient');
      const category = q.get('category');
      const hits = this.all<DocumentReference>('DocumentReference')
        .filter((d) => d.subject?.reference === patient && d.category?.some((c) => c.coding?.some((x) => `${x.system}|${x.code}` === category)))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      return fhirJson(200, searchset(hits.slice(0, count)));
    }
    if (type === 'AuditEvent') {
      const entity = q.get('entity');
      const hits = this.all<AuditEvent>('AuditEvent')
        .filter((a) => a.entity?.some((e) => e.what?.reference === entity))
        .sort((a, b) => Date.parse(b.recorded) - Date.parse(a.recorded));
      return fhirJson(200, searchset(hits.slice(0, count)));
    }
    return fhirJson(400, { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-supported' }] });
  }
}
