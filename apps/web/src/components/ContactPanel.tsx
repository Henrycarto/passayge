import { useState } from 'react';
import { FileText, IdCard, Info, Pill, Syringe } from 'lucide-react';
import { DATA_KINDS, DAY_MS, PROVIDERS, type DataKind } from '@passayge/core';
import type { AccessStatus, PublicDecision } from '@/lib/api';
import { api } from '@/lib/api';
import { fmtDateTime, fmtDayShort, fmtDuration } from '@/lib/format';
import { Status } from './Status';
import { Term, Tip } from './Tooltip';

const KIND: Record<DataKind, { label: string; de: string; term: string; icon: typeof FileText }> = {
  documents: { label: 'Documents', de: 'e-Befunde', term: 'documents', icon: FileText },
  medication: { label: 'Medication', de: 'e-Medikation', term: 'medication', icon: Pill },
  vaccinations: { label: 'Vaccinations', de: 'e-Impfpass', term: 'vaccinations', icon: Syringe },
};

/** One time scale for every record type, so 28 and 90 days compare at a glance. */
function WindowBar({ d, scaleDays, now }: { d: PublicDecision; scaleDays: number; now: Date }) {
  if (!d.contact || !d.days) return null;
  const start = Date.parse(d.contact.at);
  const pct = (ms: number) => Math.min(100, Math.max(0, (ms / (scaleDays * DAY_MS)) * 100));
  const end = pct(d.days * DAY_MS);
  const at = pct(now.getTime() - start);
  const expired = d.outcome === 'expired';
  const left = Date.parse(d.until!) - now.getTime();
  return (
    <>
      <div className={`window ${expired ? 'expired' : ''}`} role="img" aria-label={expired ? `${d.days}-day window, ended` : `${d.days}-day window, ${fmtDuration(left)} left`}>
        <span className="track" style={{ width: `${end}%` }} />
        <span className="used" style={{ width: `${Math.min(at, end)}%` }} />
        {!expired && <span className="left" style={{ left: `${at}%`, width: `${Math.max(0, end - at)}%` }} />}
        <span className="end" style={{ left: `calc(${end}% - 2px)` }} />
        <span className="now" style={{ left: `${at}%` }} />
      </div>
      <div className="window-scale num" aria-hidden="true">
        <span>{at < 14 && !expired ? 'Today' : fmtDayShort(d.contact.at)}</span>
        {!expired && at >= 14 && at <= 80 && (
          <span className="today" style={{ left: `${at}%` }}>
            Today
          </span>
        )}
        <span>{expired ? `Ended ${fmtDateTime(d.until!)}, after ${d.days} days` : `${fmtDayShort(d.until!)}, ${d.days} days`}</span>
      </div>
    </>
  );
}

function KindRow({ kind, d, scaleDays, now }: { kind: DataKind; d: PublicDecision; scaleDays: number; now: Date }) {
  const k = KIND[kind];
  const Icon = k.icon;
  const left = d.until ? Date.parse(d.until) - now.getTime() : 0;
  return (
    <div className="fn">
      <div className="fn-head">
        <Icon aria-hidden="true" size={16} />
        <span className="name">
          <Term id={k.term}>{k.label}</Term> <span className="de">({k.de})</span>
        </span>
        <Status kind={d.outcome} />
      </div>
      <WindowBar d={d} scaleDays={scaleDays} now={now} />
      <div className={`fn-note num ${d.outcome !== 'granted' ? 'act' : ''}`}>
        {d.outcome === 'granted' ? `${fmtDuration(left)} left. ` : `${d.explanation} `}
        <a href={d.sourceUrl} target="_blank" rel="noreferrer">
          {d.sourceLabel}
        </a>
      </div>
    </div>
  );
}

export function ContactPanel({ patientId, access, now, onChanged }: { patientId: string; access: AccessStatus; now: Date; onChanged: () => void }) {
  const [objection, setObjection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [portal, setPortal] = useState(false);
  const [error, setError] = useState<string>();
  const kinds = DATA_KINDS.filter((k) => access.actor.role !== 'pharmacy' || k !== 'documents');
  const contact = kinds.map((k) => access.decisions[k].contact).find(Boolean);
  const scaleDays = Math.max(90, ...kinds.map((k) => access.decisions[k].days ?? 0));
  const s = access.settings;
  const myDays = s.providerDays[access.actor.id];

  const insert = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.insertCard(patientId, objection);
      setObjection(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="kb-h">
      <div className="h2">
        <h2 id="kb-h">
          <Term id="contact-confirmation">Contact confirmation</Term> <span className="de">(Kontaktbestätigung)</span>
        </h2>
      </div>
      {contact ? (
        <dl className="kb-meta">
          <dt>Created by</dt>
          <dd>Inserting the e-card</dd>
          <dt>At</dt>
          <dd className="num">
            <time dateTime={contact.at}>{fmtDateTime(contact.at)}</time>
          </dd>
          <dt>In</dt>
          <dd>{access.actor.organisation}</dd>
          {contact.objection && (
            <>
              <dt>Objection</dt>
              <dd>
                <Term id="objection">Nothing from this visit is stored</Term>
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p style={{ margin: '0 0 var(--s3)' }}>
          You have no contact confirmation for this patient. Their records stay locked until the e-card is inserted in your {access.actor.role === 'pharmacy' ? 'pharmacy' : access.actor.role === 'hospital' ? 'hospital' : 'practice'}.
        </p>
      )}
      {contact && kinds.map((k) => <KindRow key={k} kind={k} d={access.decisions[k]} scaleDays={scaleDays} now={now} />)}

      <div className="kb-actions">
        <Tip content="Simulated. Records a contact confirmation as if the patient's e-card were inserted here now. The audit log shows it as Recorded.">
          <button type="button" className="btn primary" onClick={() => void insert()} disabled={busy} data-tour="insert-card">
            <IdCard aria-hidden="true" size={16} />
            {contact ? 'Insert e-card again' : 'Insert e-card'}
          </button>
        </Tip>
        <label className="check">
          <input type="checkbox" checked={objection} onChange={(e) => setObjection(e.target.checked)} />
          <Term id="objection">Patient objects for this visit</Term>
        </label>
        {error && (
          <p role="alert" className="fn-note act" style={{ flexBasis: '100%' }}>
            {error}
          </p>
        )}
      </div>

      <div className="prefs">
        <div className="h2" style={{ margin: 0 }}>
          <span className="src">Patient&apos;s settings in the access portal</span>
          <Tip content="Simulated. In ELGA patients change these in the access portal or through the ombudsman. Here you can play the patient.">
            <button type="button" className="btn sm" aria-expanded={portal} onClick={() => setPortal((p) => !p)}>
              {portal ? 'Close portal' : 'Change as patient'}
            </button>
          </Tip>
        </div>
        <dl>
          <dt>
            <Term id="opt-out">Opt-out</Term>
          </dt>
          <dd>{s.optOut.documents && s.optOut.medication ? 'General: documents and medication' : s.optOut.documents ? 'Documents' : s.optOut.medication ? 'Medication' : 'None'}</dd>
          <dt>Your access period</dt>
          <dd className="num">{myDays === undefined ? 'Default, not changed' : myDays === 0 ? '0 days, you are blocked' : `${myDays} days (set by the patient)`}</dd>
        </dl>
        {portal && <Portal patientId={patientId} access={access} onChanged={onChanged} />}
      </div>

      <div className="note">
        <Info aria-hidden="true" size={14} />
        <span>
          <b>
            <Term id="simplified">Simplified.</Term>
          </b>{' '}
          One sandbox service stands in for ELGA&apos;s contact confirmation service, token service and policy store. ELGA has no query that shows access in advance; software finds out by trying. Passayge shows it up front so you can see the rules.
        </span>
      </div>
    </section>
  );
}

function Portal({ patientId, access, onChanged }: { patientId: string; access: AccessStatus; onChanged: () => void }) {
  // Changes show at once and roll back if the gateway refuses them.
  const [s, setS] = useState(access.settings);
  const [error, setError] = useState<string>();
  const me = access.actor;
  const others = PROVIDERS.filter((p) => p.id !== me.id);
  const save = async (body: Parameters<typeof api.saveSettings>[1]) => {
    setError(undefined);
    const before = s;
    const providerDays = { ...s.providerDays };
    for (const [id, d] of Object.entries(body.providerDays ?? {})) {
      if (d === null) delete providerDays[id];
      else providerDays[id] = d;
    }
    setS({ optOut: body.optOut ?? s.optOut, providerDays });
    try {
      const r = await api.saveSettings(patientId, body);
      setS(r.settings);
      onChanged();
    } catch (e) {
      setS(before);
      setError((e as Error).message);
    }
  };
  const periodOptions = (role: string) => (role === 'hospital' ? [null, 0, 30, 60] : [null, 0, 30, 180, 365]);
  const periodLabel = (d: number | null, role: string) => (d === null ? `Default (${role === 'pharmacy' ? 28 : 90} days)` : d === 0 ? '0 days: blocked' : `${d} days`);
  return (
    <div className="portal" role="group" aria-label="Access portal, simulated">
      <fieldset>
        <legend>
          <Term id="opt-out">Opt-out</Term>
        </legend>
        <label className="check">
          <input type="checkbox" checked={s.optOut.documents} onChange={(e) => void save({ optOut: { ...s.optOut, documents: e.target.checked } })} /> Documents
        </label>
        <label className="check">
          <input type="checkbox" checked={s.optOut.medication} onChange={(e) => void save({ optOut: { ...s.optOut, medication: e.target.checked } })} /> Medication
        </label>
        <span className="src">The vaccination record has no opt-out (§ 24e Abs. 5 GTelG 2012).</span>
      </fieldset>
      <fieldset>
        <legend>Access periods</legend>
        {[me, ...others].map((p) => (
          <label key={p.id} className="check" style={{ justifyContent: 'space-between' }}>
            <span>{p.organisation}</span>
            <select className="input" value={String(s.providerDays[p.id] ?? 'default')} onChange={(e) => void save({ providerDays: { [p.id]: e.target.value === 'default' ? null : Number(e.target.value) } })}>
              {periodOptions(p.role).map((d) => (
                <option key={String(d)} value={d === null ? 'default' : d}>
                  {periodLabel(d, p.role)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <span className="src">
          Up to 365 days for a <Term id="trusted-provider">provider of special trust</Term>; hospitals can only be shortened (§ 18 Abs. 7 GTelG 2012).
        </span>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
