// Validates every resource the sandbox writes against a running HAPI FHIR server with the
// HL7 Austria FHIR Core package installed. Patients are checked against the AT Core Patient
// profile, everything else against the base FHIR R4 definitions.
// Fails on any error; warnings are reported but do not fail (approved policy, Phase 2).
// Run: HAPI_URL=http://localhost:8091/fhir npm run validate:fhir

import type { OperationOutcome, Resource } from 'fhir/r4';
import { AT_CORE_PATIENT, DOCUMENTS, PATIENTS, directoryBundle, documentResources, historyRecords, patientResource, toAuditEvent } from '@passayge/core';
import { guardedFetch } from '../src/egress';
import { USER_AGENT } from '../src/hapi';

const base = process.env.HAPI_URL ?? 'http://localhost:8091/fhir';
const fetcher = guardedFetch([base]);

export async function validate(resource: Resource, profile?: string): Promise<OperationOutcome> {
  const q = profile ? `?profile=${encodeURIComponent(profile)}` : '';
  const res = await fetcher(`${base}/${resource.resourceType}/$validate${q}`, {
    method: 'POST',
    headers: { 'content-type': 'application/fhir+json', accept: 'application/fhir+json', 'user-agent': USER_AGENT },
    body: JSON.stringify(resource),
  });
  return (await res.json()) as OperationOutcome;
}

export function resourcesToValidate(): { label: string; resource: Resource; profile?: string }[] {
  const out: { label: string; resource: Resource; profile?: string }[] = [];
  for (const p of PATIENTS) out.push({ label: `Patient/${p.id}`, resource: patientResource(p), profile: AT_CORE_PATIENT });
  for (const e of directoryBundle().entry ?? []) out.push({ label: e.request!.url, resource: e.resource! });
  for (const d of DOCUMENTS) {
    const [ref, bin] = documentResources(d);
    out.push({ label: `DocumentReference/${d.id}`, resource: ref }, { label: `Binary/${bin.id}`, resource: bin });
  }
  for (const r of historyRecords().slice(0, 5)) out.push({ label: `AuditEvent/${r.id}`, resource: { ...toAuditEvent(r, false), id: r.id } });
  return out;
}

async function main() {
  let errors = 0;
  let warnings = 0;
  const list = resourcesToValidate();
  for (const { label, resource, profile } of list) {
    const oo = await validate(resource, profile);
    const errs = (oo.issue ?? []).filter((i) => i.severity === 'error' || i.severity === 'fatal');
    const warns = (oo.issue ?? []).filter((i) => i.severity === 'warning');
    errors += errs.length;
    warnings += warns.length;
    for (const i of errs) console.error(`ERROR   ${label}: ${i.diagnostics}`);
    for (const i of warns) console.log(`warning ${label}: ${i.diagnostics?.slice(0, 160)}`);
  }
  console.log(`\nValidated ${list.length} resources: ${errors} errors, ${warnings} warnings.`);
  if (errors) process.exit(1);
}

if (process.argv[1]?.endsWith('validate-fhir.ts')) await main();
