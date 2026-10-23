// Loads the synthetic world into HAPI: directory, patients with their documents (as MHD Provide
// Document Bundles, ITI-65) and the audit history. Every write is a PUT with a fixed id, so
// seeding twice changes nothing.

import type { Bundle } from 'fhir/r4';
import { PATIENTS, SESSION_TAG, directoryBundle, historyRecords, patientBundle, toAuditEvent } from '@passayge/core';
import type { Hapi } from './hapi';

export async function waitForHapi(hapi: Hapi, timeoutMs = 240_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await hapi.call('ITI-78', 'startup', 'GET', 'metadata', { quiet: true });
      if (r.status === 200) return;
    } catch {
      // HAPI is still starting.
    }
    if (Date.now() > until) throw new Error('HAPI FHIR did not become ready in time.');
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function post(hapi: Hapi, bundle: Bundle, note: string, quiet = false): Promise<void> {
  const r = await hapi.call('ITI-65', 'seed', 'POST', '', { body: bundle, note, quiet });
  if (r.status >= 300) throw new Error(`Seeding failed (${r.status}): ${r.body.slice(0, 500)}`);
}

/** Removes the audit events written during sessions; the seeded history stays. */
export async function clearSessionAudit(hapi: Hapi): Promise<void> {
  await hapi.call('ITI-20', 'reset', 'DELETE', `AuditEvent?_tag=${encodeURIComponent(`${SESSION_TAG.system}|${SESSION_TAG.code}`)}`, { quiet: true });
}

export async function seed(hapi: Hapi): Promise<void> {
  await clearSessionAudit(hapi);
  await post(hapi, directoryBundle(), 'Directory: synthetic practices, hospital, pharmacy and authors.', true);
  for (const p of PATIENTS) await post(hapi, patientBundle(p), `Synthetic patient ${p.family.toUpperCase()}, ${p.given} with documents.`);
  const history: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: historyRecords().map((r) => ({
      resource: { ...toAuditEvent(r, false), id: r.id },
      request: { method: 'PUT' as const, url: `AuditEvent/${r.id}` },
    })),
  };
  await post(hapi, history, 'Audit history before the simulated clock starts.', true);
}
