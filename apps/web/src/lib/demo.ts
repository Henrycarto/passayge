// Demo mode: the sandbox engine runs in the browser with an in-memory FHIR store, so the client
// can be hosted as static files. Same routes, rules, audit records and network log as the gateway;
// no HAPI server and no AT Core validation. State lives in this tab and resets on reload.

import { Engine, MemoryFhir, NetLog, SIM_START, SimClock, seedFhir } from '@passayge/core';

const clock = new SimClock(SIM_START);
const netlog = new NetLog();
const fhir = new MemoryFhir(netlog, clock);
const engine = new Engine({ fhir, clock, netlog });
const ready = seedFhir(fhir);

/** A fetch for the client's own /api and /fhir paths, answered by the in-browser engine. */
export async function demoFetch(input: string, init?: RequestInit): Promise<Response> {
  await ready;
  const body = typeof init?.body === 'string' && init.body ? (JSON.parse(init.body) as unknown) : undefined;
  const r = await engine.handle({ method: init?.method ?? 'GET', url: input, body });
  return new Response(r.body, { status: r.status, headers: { 'content-type': r.type } });
}
