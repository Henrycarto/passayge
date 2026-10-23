import { useEffect, useRef, useState } from 'react';
import { ClockAlert, FlaskConical, Lock, LockOpen } from 'lucide-react';
import type { Patient } from 'fhir/r4';
import { DATA_KINDS, type DataKind } from '@passayge/core';
import { pickIdentifier, pickName, formatName } from './banner-helpers';
import type { AccessStatus } from '@/lib/api';
import { ageOn, fmtDateTime, fmtDay, fmtSvnr } from '@/lib/format';
import { Term } from './Tooltip';

const KIND_NAME: Record<DataKind, string> = { documents: 'documents', medication: 'medication', vaccinations: 'vaccinations' };

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The one sentence that answers "may I look?", for the banner. */
export function summarise(a: AccessStatus): { tone: 'granted' | 'denied' | 'expired'; title: string; lines: string[] } {
  const kinds = DATA_KINDS.filter((k) => a.actor.role !== 'pharmacy' || k !== 'documents');
  const granted = kinds.filter((k) => a.decisions[k].outcome === 'granted');
  const expired = kinds.filter((k) => a.decisions[k].outcome === 'expired');
  const lines: string[] = [];
  const byUntil = new Map<string, DataKind[]>();
  for (const k of granted) {
    const u = a.decisions[k].until!;
    byUntil.set(u, [...(byUntil.get(u) ?? []), k]);
  }
  for (const [until, ks] of byUntil) lines.push(`${cap(list(ks.map((k) => KIND_NAME[k])))} until ${fmtDateTime(until)}.`);
  for (const k of expired) lines.push(`${cap(KIND_NAME[k])} expired ${fmtDateTime(a.decisions[k].until!)}.`);
  for (const k of kinds.filter((x) => a.decisions[x].outcome === 'denied')) lines.push(`${cap(KIND_NAME[k])}: ${a.decisions[k].explanation}`);
  if (granted.length === 0) {
    const anyContact = kinds.some((k) => a.decisions[k].reason !== 'no-contact');
    return {
      tone: expired.length ? 'expired' : 'denied',
      title: expired.length ? 'Access expired' : 'No access',
      lines: anyContact ? lines : ['No contact confirmation from you for this patient.', 'Insert the e-card to request access.'],
    };
  }
  return { tone: 'granted', title: granted.length === kinds.length ? 'Access granted' : `Access granted, ${granted.length} of ${kinds.length}`, lines };
}

export function Banner({ patient, access, now }: { patient: Patient; access?: AccessStatus; now: Date }) {
  const name = formatName(pickName(patient.name));
  const id = pickIdentifier(patient.identifier);
  const addr = patient.address?.[0];
  const s = access ? summarise(access) : undefined;
  const Icon = s?.tone === 'granted' ? LockOpen : s?.tone === 'expired' ? ClockAlert : Lock;
  // The lock opens when access is newly granted (motion that explains a change).
  const prev = useRef(s?.tone);
  const [justOpened, setJustOpened] = useState(false);
  useEffect(() => {
    if (s?.tone === 'granted' && prev.current && prev.current !== 'granted') setJustOpened(true);
    prev.current = s?.tone;
  }, [s?.tone]);
  return (
    <section className="banner" aria-label={`Patient: ${name}`}>
      <div>
        <h1>
          {name}
          <span className="tag">
            <FlaskConical aria-hidden="true" size={14} />
            <Term id="synthetic">Synthetic</Term>
          </span>
        </h1>
        <dl className="facts">
          <div>
            <dt>Born</dt>
            <dd className="num">{patient.birthDate ? `${fmtDay(patient.birthDate)} (${ageOn(patient.birthDate, now)} years)` : 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Gender (administrative)</dt>
            <dd>{patient.gender ? cap(patient.gender) : 'Not recorded'}</dd>
          </div>
          <div>
            <dt>
              <Term id="svnr">Social security number</Term> (synthetic)
            </dt>
            <dd className="id">{id?.value ? fmtSvnr(id.value) : 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{addr ? `${addr.line?.join(', ')}, ${addr.postalCode} ${addr.city}` : 'Not recorded'}</dd>
          </div>
        </dl>
      </div>
      {s && (
        <div className={`access ${s.tone}`} role="status" aria-live="polite" data-tour="access">
          <span className="glyph">
            <Icon aria-hidden="true" size={18} className={justOpened ? 'just' : undefined} onAnimationEnd={() => setJustOpened(false)} />
          </span>
          <b>{s.title}</b>
          <small className="num">
            {s.lines.map((l, k) => (
              <span key={k} style={{ display: 'block' }}>
                {l}
              </span>
            ))}
          </small>
        </div>
      )}
    </section>
  );
}
