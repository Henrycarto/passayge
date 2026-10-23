import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { PATIENTS, SOURCES, TRANSACTIONS, type AuditRecord, type TransactionId } from '@passayge/core';
import { CHANGED, api, type NetEntry } from '@/lib/api';
import { dayKey, fmtDay, fmtTimeS, fmtWeekday } from '@/lib/format';
import { navigate, onLinkClick } from '@/lib/route';
import { useSession } from '@/lib/session';
import { DEMO } from '@/lib/mode';
import { Status } from '@/components/Status';
import { Term, Tip } from '@/components/Tooltip';

export const LAST_PATIENT = 'passayge.lastPatient';

const PROCESSING: Record<string, string> = {
  search: 'Search (query)',
  read: 'Read (retrieve document)',
  create: 'Create (store document)',
  update: 'Update',
  contact: 'Create (contact confirmation)',
  settings: 'Update (patient settings)',
};

export function LogPage({ tab }: { tab: 'audit' | 'network' }) {
  const params = new URLSearchParams(location.search);
  const patientId = params.get('patient') ?? sessionStorage.getItem(LAST_PATIENT) ?? PATIENTS[0]!.id;
  const setPatient = (id: string) => navigate(`/log${tab === 'network' ? '/network' : ''}?patient=${id}`);
  return (
    <>
      <h1 className="sr-only">{tab === 'audit' ? 'Audit log' : 'Network log'}</h1>
      <div className="filters">
        <nav className="subtabs" aria-label="Log views">
          <a aria-current={tab === 'audit' ? 'page' : undefined} href={`/log?patient=${patientId}`} onClick={onLinkClick(`/log?patient=${patientId}`)}>
            Audit log
          </a>
          <a aria-current={tab === 'network' ? 'page' : undefined} href={`/log/network?patient=${patientId}`} onClick={onLinkClick(`/log/network?patient=${patientId}`)} data-tour="nav-network">
            Network
          </a>
        </nav>
        <span className="src">
          <Term id="audit-log">What is logged?</Term>
        </span>
        <span className="spacer" />
        {tab === 'audit' && (
          <label>
            Patient
            <select className="input" value={patientId} onChange={(e) => setPatient(e.target.value)}>
              {PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.family.toUpperCase()}, {p.given}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {tab === 'audit' ? <AuditView key={patientId} patientId={patientId} /> : <NetworkView />}
    </>
  );
}

function AuditView({ patientId }: { patientId: string }) {
  const { version } = useSession();
  const [records, setRecords] = useState<AuditRecord[]>();
  const [error, setError] = useState<string>();
  const [outcome, setOutcome] = useState('all');
  const [role, setRole] = useState('all');
  const [sel, setSel] = useState<string>();
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .audit(patientId)
        .then((r) => {
          if (!live) return;
          const ids = r.records.map((x) => x.id!);
          const first = seen.current.size === 0;
          setFresh(new Set(first ? [] : ids.filter((x) => !seen.current.has(x))));
          seen.current = new Set(ids);
          setRecords(r.records);
          setSel((s) => s ?? r.records[0]?.id);
        })
        .catch((e: unknown) => live && setError((e as Error).message));
    void load();
    return () => {
      live = false;
    };
  }, [patientId, version]);

  const shown = useMemo(
    () => (records ?? []).filter((r) => (outcome === 'all' || r.outcome === outcome) && (role === 'all' || r.role === role)),
    [records, outcome, role],
  );
  const current = shown.find((r) => r.id === sel) ?? shown[0];

  // J and K move through the log, as in many keyboard-first tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const i = shown.findIndex((r) => r.id === current?.id);
      const next = shown[Math.min(shown.length - 1, Math.max(0, i + (e.key === 'j' ? 1 : -1)))];
      if (next) {
        setSel(next.id);
        document.getElementById(`audit-${next.id}`)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, current]);

  if (error) return <p className="page">{error}</p>;
  if (!records) return <p className="page empty">Loading the audit log…</p>;

  // A day heading before the first row of each calendar day.
  const firstOfDay = new Set(shown.filter((r, i) => i === 0 || dayKey(r.at) !== dayKey(shown[i - 1]!.at)).map((r) => r.id));
  return (
    <div className="log">
      <div className="log-list">
        <div className="filters" style={{ padding: 'var(--s3) 0', border: 0 }}>
          <label>
            Outcome
            <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="all">All</option>
              <option value="granted">Granted</option>
              <option value="denied">Denied</option>
              <option value="expired">Expired</option>
              <option value="recorded">Recorded</option>
              <option value="void">Entered in error</option>
            </select>
          </label>
          <label>
            Role
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="all">All</option>
              <option value="doctor">Doctor</option>
              <option value="hospital">Hospital</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="author">Document author</option>
              <option value="patient">Patient</option>
            </select>
          </label>
          <span className="spacer" />
          <span className="src num" aria-live="polite">
            {shown.length} of {records.length} events
          </span>
          <span className="src">
            <kbd>J</kbd> <kbd>K</kbd> to move
          </span>
        </div>
        {shown.length === 0 ? (
          <p className="empty">No events match these filters. Set Outcome and Role to All to see everything.</p>
        ) : (
          <table className="audit stack">
            <colgroup>
              <col className="c-time" />
              <col className="c-who" />
              <col />
              <col className="c-out" />
              <col className="c-why hide-t" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Outcome</th>
                <th scope="col" className="hide-t">
                  Why
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.flatMap((r) => {
                const rows = [];
                if (firstOfDay.has(r.id)) {
                  rows.push(
                    <tr key={`d-${dayKey(r.at)}`} className="daysep">
                      <td colSpan={5}>{fmtWeekday(r.at)}</td>
                    </tr>,
                  );
                }
                rows.push(
                  <tr key={r.id} className={`row ${current?.id === r.id ? 'sel' : ''} ${fresh.has(r.id!) ? 'fresh' : ''}`} onClick={() => setSel(r.id)}>
                    <td className="date">
                      <button type="button" id={`audit-${r.id}`} className="rowbtn" aria-current={current?.id === r.id ? 'true' : undefined} onClick={(e) => { e.stopPropagation(); setSel(r.id); }}>
                        <time dateTime={r.at}>{fmtTimeS(r.at)}</time>
                        <span className="sr-only">, {r.description}, {r.outcome}</span>
                      </button>
                    </td>
                    <td className="who">
                      <b>{r.person}</b>
                      <span className="sub">{r.organisation}</span>
                    </td>
                    <td>
                      {r.description}
                      <span className="sub">{r.dataLabel}</span>
                    </td>
                    <td>
                      <Status kind={r.outcome} />
                    </td>
                    <td className="why hide-t">{r.explanation}</td>
                  </tr>,
                );
                return rows;
              })}
            </tbody>
          </table>
        )}
      </div>
      {current && <AuditDetail key={current.id} record={current} />}
    </div>
  );
}

function AuditDetail({ record: r }: { record: AuditRecord }) {
  const [net, setNet] = useState<NetEntry[]>();
  useEffect(() => {
    let live = true;
    api
      .networkFor(r.transactionNumber)
      .then((x) => live && setNet(x.entries))
      .catch(() => live && setNet([]));
    return () => {
      live = false;
    };
  }, [r.transactionNumber]);
  const src = r.source ? SOURCES[r.source] : undefined;
  return (
    <aside className="detail" aria-labelledby="detail-h">
      <h2 id="detail-h">Audit record</h2>
      <p className="src" style={{ margin: 0 }}>
        The fields every access must log under{' '}
        <a href={SOURCES.gtelg22_2.url} target="_blank" rel="noreferrer">
          {SOURCES.gtelg22_2.label}
        </a>
      </p>
      <dl className="fields">
        <dt>Date and time</dt>
        <dd className="num">
          {fmtDay(r.at)}, {fmtTimeS(r.at)}
        </dd>
        <dt>Transaction number</dt>
        <dd className="id">{r.transactionNumber}</dd>
        <dt>Type of processing</dt>
        <dd>{PROCESSING[r.processing] ?? r.processing}</dd>
        <dt>Provider</dt>
        <dd>{r.organisation}</dd>
        <dt>Person</dt>
        <dd>{r.person}</dd>
        <dt>Data</dt>
        <dd>
          {r.dataLabel}
          {r.dataRef && (
            <span className="src" style={{ display: 'block' }}>
              <span className="id">{r.dataRef}</span>
            </span>
          )}
        </dd>
        <dt>Query criteria</dt>
        <dd className="mono meta">{r.query ?? 'None'}</dd>
        <dt>Outcome</dt>
        <dd>
          <Status kind={r.outcome} />
        </dd>
        <dt>Reason</dt>
        <dd>
          {r.explanation}
          {src && (
            <>
              {' '}
              <a href={src.url} target="_blank" rel="noreferrer">
                {src.label}
              </a>
            </>
          )}
        </dd>
        <dt>Error message</dt>
        <dd>{r.outcome === 'denied' || r.outcome === 'expired' ? r.explanation : 'None'}</dd>
      </dl>
      <h2>Network transactions</h2>
      <p className="src" style={{ margin: 0 }}>
        Each sandbox call for this event, with the ELGA transaction it stands in for
      </p>
      {!net ? (
        <p className="empty">Loading…</p>
      ) : net.length === 0 ? (
        <p className="src">No network record for this event. The network log covers the current sandbox session; earlier entries come from the seeded history.</p>
      ) : (
        <ol className="seq">
          {net.map((e) => (
            <NetItem key={e.id} e={e} />
          ))}
        </ol>
      )}
    </aside>
  );
}

function NetItem({ e, showTime }: { e: NetEntry; showTime?: boolean }) {
  const t = TRANSACTIONS[e.transaction];
  return (
    <li>
      {showTime && (
        <div className="src num">
          <time dateTime={e.at}>{fmtTimeS(e.at)}</time>
        </div>
      )}
      <div className="line1">
        <Tip content={t.explain}>
          <span className="ihe" tabIndex={0}>
            {t.code}
          </span>
        </Tip>
        <span>{t.name}</span>
        <span className="grow" />
        <span className={e.status < 400 ? 'code-ok' : 'code-no'}>{e.status}</span>
        <span className="src num">{e.ms} ms</span>
      </div>
      <div className="http">
        {e.method} {e.path}
      </div>
      {t.elga && (
        <div className="maps">
          <ArrowRightLeft aria-hidden="true" size={14} />
          <span className="elgatag">In ELGA</span>
          <span>
            {t.elga}
            {t.simplified ? '. ' : ''}
            {t.simplified && (
              <b>
                <Term id="simplified">Simplified</Term>
              </b>
            )}
          </span>
        </div>
      )}
      {e.note && <div className="note-line muted">{e.note}</div>}
      {e.excerpt && (
        <details>
          <summary>Show {e.method === 'GET' ? 'response' : 'request'}</summary>
          <pre className="payload">{e.excerpt}</pre>
        </details>
      )}
    </li>
  );
}

function NetworkView() {
  const [entries, setEntries] = useState<NetEntry[]>();
  const [filter, setFilter] = useState<'all' | TransactionId>('all');
  useEffect(() => {
    const load = () => {
      window.setTimeout(() => {
        api
          .network()
          .then((r) => setEntries(r.entries.slice().reverse()))
          .catch(() => setEntries([]));
      }, 250);
    };
    load();
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, []);
  const shown = (entries ?? []).filter((e) => filter === 'all' || e.transaction === filter);
  return (
    <div className="log-list" style={{ maxWidth: 960 }}>
      <div className="filters" style={{ padding: 'var(--s3) 0', border: 0 }}>
        <label>
          Transaction
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | TransactionId)}>
            <option value="all">All</option>
            {Object.values(TRANSACTIONS).map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}: {t.name}
              </option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        <span className="src num">{shown.length} calls this session, newest first</span>
      </div>
      <p className="src" style={{ marginTop: 0 }}>
        Every call the sandbox made, named by its <Term id="iti">IHE transaction</Term>. The client talks only to the sandbox gateway; the gateway talks only to its own <Term id="fhir">FHIR</Term> server. Nothing goes to ELGA or any real service.
        {DEMO && ' In demo mode the calls are answered in your browser by an in-memory FHIR store standing in for HAPI FHIR.'}
      </p>
      {!entries ? (
        <p className="empty">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="empty">No calls yet. Open a patient or insert an e-card, then come back.</p>
      ) : (
        <ol className="seq plain">
          {shown.map((e) => (
            <NetItem key={e.id} e={e} showTime />
          ))}
        </ol>
      )}
    </div>
  );
}
