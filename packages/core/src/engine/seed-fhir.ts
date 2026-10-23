// Loads the synthetic world into a FHIR server: directory, patients with their documents (as MHD
// Provide Document Bundles, ITI-65) and the audit history. Every write is a PUT with a fixed id,
// so seeding twice changes nothing.

import type { Bundle } from 'fhir/r4';
import { SESSION_TAG, toAuditEvent } from '../audit';
import { directoryBundle, patientBundle } from '../fhir';
import { historyRecords } from '../history';
import { PATIENTS } from '../seed';
import type { FhirClient } from './fhir-client';

async function post(fhir: FhirClient, bundle: Bundle, note: string, quiet = false): Promise<void> {
  const r = await fhir.call('ITI-65', 'seed', 'POST', '', { body: bundle, note, quiet });
  if (r.status >= 300) throw new Error(`Seeding failed (${r.status}): ${r.body.slice(0, 500)}`);
}

/** Removes the audit events written during sessions; the seeded history stays. */
export async function clearSessionAudit(fhir: FhirClient): Promise<void> {
  await fhir.call('ITI-20', 'reset', 'DELETE', `AuditEvent?_tag=${encodeURIComponent(`${SESSION_TAG.system}|${SESSION_TAG.code}`)}`, { quiet: true });
}

export async function seedFhir(fhir: FhirClient): Promise<void> {
  await clearSessionAudit(fhir);
  await post(fhir, directoryBundle(), 'Directory: synthetic practices, hospital, pharmacy and authors.', true);
  for (const p of PATIENTS) await post(fhir, patientBundle(p), `Synthetic patient ${p.family.toUpperCase()}, ${p.given} with documents.`);
  const history: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: historyRecords().map((r) => ({
      resource: { ...toAuditEvent(r, false), id: r.id },
      request: { method: 'PUT' as const, url: `AuditEvent/${r.id}` },
    })),
  };
  await post(fhir, history, 'Audit history before the simulated clock starts.', true);
}
