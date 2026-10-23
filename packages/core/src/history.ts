// Audit history that exists before the simulated clock starts, so the log is not empty on first
// open. Derived from the seed: every contact, every stored document, plus a few earlier attempts.

import type { AuditRecord } from './audit';
import { decide, explain, type Contact } from './rules';
import { CONTACTS, DOCUMENTS, PROVIDERS, SETTINGS, recordKindOf, type Provider } from './seed';

const provider = (id: string): Provider => {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown provider ${id}`);
  return p;
};

const by = (p: Provider) => ({ providerId: p.id, organisation: p.organisation, person: p.person, personRef: `${p.id}-person`, role: p.role });

const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Vienna' }).format(new Date(iso));

/** An attempt by a provider at a given time, decided by the same rules the gateway uses. */
function attempt(id: string, at: string, providerId: string, patientId: string, kind: 'documents' | 'medication', processing: 'search' | 'read', description: string, dataLabel: string, contacts: readonly Contact[]): AuditRecord {
  const p = provider(providerId);
  const d = decide({ role: p.role, providerId, kind, contacts: contacts.filter((c) => c.patientId === patientId), settings: SETTINGS[patientId]!, now: new Date(at) });
  return { id, at, transactionNumber: id, processing, description, dataLabel, outcome: d.outcome, reason: d.reason, explanation: explain(d), source: d.source, kind, patientId, ...by(p) };
}

export function historyRecords(): AuditRecord[] {
  const out: AuditRecord[] = [];
  for (const c of CONTACTS) {
    const p = provider(c.providerId);
    out.push({
      id: `hist-${c.id}`, at: c.at, transactionNumber: `hist-${c.id}`, processing: 'contact', description: 'Recorded contact confirmation', dataLabel: 'e-card, simulated',
      outcome: 'recorded', explanation: `Contact confirmation from the e-card. ${p.role === 'pharmacy' ? 'Pharmacy window: 28 days.' : 'Window: 90 days.'}`, source: 'gtelg18_6', patientId: c.patientId, ...by(p),
    });
  }
  for (const d of DOCUMENTS) {
    const authorProvider = PROVIDERS.find((p) => p.id === d.author.id);
    const person = d.person ?? (authorProvider && authorProvider.role !== 'pharmacy' ? authorProvider.person : undefined);
    const knownPerson = authorProvider && authorProvider.person === person ? authorProvider : undefined;
    out.push({
      id: `hist-store-${d.id}`, at: new Date(d.date).toISOString(), transactionNumber: `hist-store-${d.id}`, processing: 'create', description: 'Stored document',
      dataLabel: `${d.title}, ${fmtDay(d.date)}`, dataRef: `DocumentReference/${d.id}`, outcome: 'recorded', explanation: 'Document stored and registered.',
      kind: recordKindOf(d.kind), patientId: d.patientId, providerId: d.author.id, organisation: d.author.name, person: person ?? 'Batch process',
      personRef: knownPerson ? `${knownPerson.id}-person` : undefined, role: 'author',
    });
    if (d.status === 'entered-in-error') {
      const successor = DOCUMENTS.find((x) => x.replaces === d.id);
      out.push({
        id: `hist-void-${d.id}`, at: new Date(successor?.date ?? d.date).toISOString(), transactionNumber: `hist-void-${d.id}`, processing: 'update', description: 'Marked document as entered in error',
        dataLabel: `${d.title}, ${fmtDay(d.date)}`, dataRef: `DocumentReference/${d.id}`, outcome: 'void', explanation: 'Withdrawn by the author and replaced by a corrected report.',
        kind: recordKindOf(d.kind), patientId: d.patientId, providerId: d.author.id, organisation: d.author.name, person: 'Batch process', role: 'author',
      });
    }
  }
  out.push(
    attempt('hist-att-1', '2026-08-18T07:31:40.000Z', 'prov-wimmer', 'pas-theresia', 'documents', 'search', 'Searched documents', 'Documents', CONTACTS),
    attempt('hist-att-2', '2026-10-15T08:12:05.000Z', 'prov-kgf', 'pas-herta', 'documents', 'search', 'Searched documents', 'Documents', CONTACTS),
    attempt('hist-att-3', '2026-10-23T09:14:50.000Z', 'prov-hirsch', 'pas-theresia', 'medication', 'read', 'Read medication list', 'Medication list', CONTACTS),
  );
  // A pharmacy asking for documents: refused by role before any contact is looked at.
  const ph = provider('prov-hirsch');
  out.push({
    id: 'hist-att-4', at: '2026-10-23T09:15:07.000Z', transactionNumber: 'hist-att-4', processing: 'search', description: 'Searched documents', dataLabel: 'Documents',
    outcome: 'denied', reason: 'not-for-role', explanation: 'Pharmacies may see medication data only.', source: 'gtelg21_2', kind: 'documents', patientId: 'pas-theresia', ...by(ph),
  });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
