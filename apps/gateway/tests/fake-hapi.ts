// A small in-memory stand-in for HAPI FHIR, enough for the gateway's unit tests. The integration
// tests run the same flows against a real HAPI server in Docker.

import type { AuditEvent, Bundle, DocumentReference, Resource } from 'fhir/r4';
import type { Fetch } from '../src/egress';

export interface FakeHapi {
  fetch: Fetch;
  calls: { method: string; url: string; headers: Record<string, string> }[];
  store: Map<string, Resource & { id?: string }>;
  audits: () => AuditEvent[];
}

export const HAPI = 'http://hapi.test/fhir';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/fhir+json' } });
const bundle = (rs: Resource[]): Bundle => ({ resourceType: 'Bundle', type: 'searchset', total: rs.length, entry: rs.map((resource) => ({ resource })) });

export function fakeHapi(): FakeHapi {
  const store = new Map<string, Resource & { id?: string }>();
  const calls: FakeHapi['calls'] = [];
  let nextId = 1;
  const all = (type: string) => [...store.values()].filter((r) => r.resourceType === type);

  const fetch: Fetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url: input, headers: (init?.headers ?? {}) as Record<string, string> });
    const u = new URL(input);
    const path = u.pathname.replace(/^\/fhir\/?/, '');
    const q = u.searchParams;
    const body = init?.body ? (JSON.parse(String(init.body)) as Resource) : undefined;

    if (path === 'metadata') return json(200, { resourceType: 'CapabilityStatement' });
    if (method === 'POST' && path === '') {
      for (const e of (body as Bundle).entry ?? []) store.set(e.request!.url, e.resource as Resource);
      return json(200, { resourceType: 'Bundle', type: 'transaction-response' });
    }
    if (method === 'POST' && path === 'AuditEvent') {
      const id = `ae-${nextId++}`;
      store.set(`AuditEvent/${id}`, { ...body!, id });
      return json(201, { ...body, id });
    }
    if (method === 'DELETE' && path === 'AuditEvent') {
      const [system, code] = (q.get('_tag') ?? '').split('|');
      for (const [k, r] of store) if (r.resourceType === 'AuditEvent' && r.meta?.tag?.some((t) => t.system === system && t.code === code)) store.delete(k);
      return json(200, { resourceType: 'OperationOutcome' });
    }
    if (method !== 'GET') return json(405, {});

    const [type, id] = path.split('/') as [string, string | undefined];
    if (id) {
      const r = store.get(`${type}/${id}`);
      if (!r) return json(404, { resourceType: 'OperationOutcome' });
      if (type === 'Binary' && !String((init?.headers as Record<string, string>)?.accept).includes('fhir')) {
        const b = r as { data?: string };
        return new Response(Buffer.from(b.data ?? '', 'base64').toString('utf8'), { status: 200, headers: { 'content-type': 'text/xml' } });
      }
      return json(200, r);
    }
    if (type === 'Patient') {
      const family = q.get('family')?.toLowerCase();
      const ident = q.get('identifier');
      const hits = all('Patient').filter((p) => {
        const pt = p as { name?: { family?: string }[]; identifier?: { system?: string; value?: string }[] };
        if (family && !pt.name?.some((n) => n.family?.toLowerCase().startsWith(family))) return false;
        if (ident && !pt.identifier?.some((i) => `${i.system}|${i.value}` === ident)) return false;
        return true;
      });
      return json(200, bundle(hits));
    }
    if (type === 'DocumentReference') {
      const patient = q.get('patient');
      const category = q.get('category');
      const hits = (all('DocumentReference') as DocumentReference[]).filter(
        (d) => d.subject?.reference === patient && d.category?.some((c) => c.coding?.some((x) => `${x.system}|${x.code}` === category)),
      );
      return json(200, bundle(hits));
    }
    if (type === 'AuditEvent') {
      const entity = q.get('entity');
      const hits = (all('AuditEvent') as AuditEvent[]).filter((a) => a.entity?.some((e) => e.what?.reference === entity)).sort((a, b) => b.recorded.localeCompare(a.recorded));
      return json(200, bundle(hits));
    }
    return json(400, {});
  };

  return { fetch, calls, store, audits: () => all('AuditEvent') as AuditEvent[] };
}
