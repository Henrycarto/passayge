import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ClockAlert, FileText, Lock, Pill, Syringe, TriangleAlert } from 'lucide-react';
import type { DocumentReference } from 'fhir/r4';
import { ABNORMAL_COUNT, DATA_KINDS, type DataKind } from '@passayge/core';
import { ApiError, api, type AccessStatus, type PublicDecision } from '@/lib/api';
import { fmtDay } from '@/lib/format';
import { Reader } from './Reader';
import { Status } from './Status';
import { Tip } from './Tooltip';
import { useEdgeFade } from '@/lib/useEdgeFade';

const TAB: Record<DataKind, { label: string; icon: typeof FileText; term: string }> = {
  documents: { label: 'Documents', icon: FileText, term: 'documents' },
  medication: { label: 'Medication', icon: Pill, term: 'medication' },
  vaccinations: { label: 'Vaccinations', icon: Syringe, term: 'vaccinations' },
};

interface Loaded {
  key: string;
  kind: DataKind;
  docs?: DocumentReference[];
  denied?: { message: string; decision?: PublicDecision };
}

/** "4 results out of range": read from the document summary the author registered. */
function flagOf(doc: DocumentReference): string | undefined {
  return doc.extension?.find((e) => e.url === ABNORMAL_COUNT)?.valueString;
}

export function Records({ patientId, access, version }: { patientId: string; access: AccessStatus; version: number }) {
  const role = access.actor.role;
  const kinds = useMemo(() => DATA_KINDS.filter((k) => role !== 'pharmacy' || k !== 'documents'), [role]);
  const [chosen, setKind] = useState<DataKind>(kinds[0]!);
  const kind = kinds.includes(chosen) ? chosen : kinds[0]!;
  const [loaded, setLoaded] = useState<Loaded>();
  const [selected, setSelected] = useState<string>();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // On narrow screens the tabs scroll sideways; a fade marks the edge that hides more.
  const strip = useRef<HTMLDivElement>(null);
  const fade = useEdgeFade(strip);

  const key = `${patientId}|${kind}|${version}`;
  useEffect(() => {
    let live = true;
    api
      .documents(patientId, kind)
      .then((docs) => {
        if (!live) return;
        setLoaded({ key, kind, docs });
        setSelected((s) => (s && docs.some((d) => d.id === s) ? s : docs.find((d) => d.status === 'current')?.id));
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) setLoaded({ key, kind, denied: { message: e.message, decision: e.decision } });
        else setLoaded({ key, kind, denied: { message: (e as Error).message } });
      });
    return () => {
      live = false;
    };
  }, [key, patientId, kind]);
  const current = loaded?.key === key ? loaded : undefined;

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : undefined;
    if (next === undefined) return;
    const j = (next + kinds.length) % kinds.length;
    setKind(kinds[j]!);
    tabs.current[j]?.focus();
    tabs.current[j]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const doc = current?.docs?.find((d) => d.id === selected);

  return (
    <section className="panel" aria-label="Records">
      <div className="tabs-wrap" data-fade-left={fade.left || undefined} data-fade-right={fade.right || undefined}>
      <div className="tabs" role="tablist" aria-label="Record types" data-tour="records" ref={strip}>
        {kinds.map((k, i) => {
          const d = access.decisions[k];
          const Icon = d.outcome === 'granted' ? TAB[k].icon : d.outcome === 'expired' ? ClockAlert : Lock;
          return (
            <button
              key={k}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`tab-${k}`}
              aria-controls={`panel-${k}`}
              aria-selected={kind === k}
              tabIndex={kind === k ? 0 : -1}
              onClick={() => setKind(k)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <Icon aria-hidden="true" size={16} />
              {TAB[k].label}
              <span className="count">{d.outcome === 'granted' ? (current?.kind === k && current.docs ? current.docs.length : '') : d.outcome === 'expired' ? 'expired' : 'locked'}</span>
            </button>
          );
        })}
      </div>
      </div>
      <div role="tabpanel" id={`panel-${kind}`} aria-labelledby={`tab-${kind}`}>
        {!current ? (
          <p className="empty">Loading…</p>
        ) : current.denied ? (
          <Locked kind={kind} denied={current.denied} />
        ) : current.docs!.length === 0 ? (
          <p className="empty">
            Nothing stored for this patient.{' '}
            {access.settings.optOut[kind as 'documents' | 'medication'] ? 'The patient has opted out, so nothing new is stored.' : ''}
          </p>
        ) : (
          <>
            <DocTable docs={current.docs!} selected={selected} onSelect={setSelected} />
            {doc && <Reader key={doc.id} doc={doc} />}
          </>
        )}
      </div>
    </section>
  );
}

function Locked({ kind, denied }: { kind: DataKind; denied: { message: string; decision?: PublicDecision } }) {
  const d = denied.decision;
  const expired = d?.outcome === 'expired';
  return (
    <div className="locked">
      <h2>
        {expired ? <ClockAlert aria-hidden="true" size={18} /> : <Lock aria-hidden="true" size={18} />}
        {TAB[kind].label} {expired ? 'access expired' : 'are locked'}
      </h2>
      <p>{denied.message}</p>
      <p className="src">
        No request reached the document registry, so nothing about these records was disclosed. The attempt is in the audit log as{' '}
        <Status kind={d?.outcome === 'expired' ? 'expired' : 'denied'} />.
        {d && (
          <>
            {' '}
            Rule:{' '}
            <a href={d.sourceUrl} target="_blank" rel="noreferrer">
              {d.sourceLabel}
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}

function DocTable({ docs, selected, onSelect }: { docs: DocumentReference[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <table className="stack">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Document</th>
          <th scope="col">From</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((d) => {
          const voided = d.status === 'entered-in-error';
          const flag = flagOf(d);
          return (
            <tr key={d.id} className={`row ${selected === d.id ? 'sel' : ''} ${voided ? 'void' : ''}`} onClick={() => onSelect(d.id!)}>
              <td className="date">{d.date ? fmtDay(d.date) : 'Undated'}</td>
              <td>
                <button type="button" className="rowbtn doc" onClick={(e) => { e.stopPropagation(); onSelect(d.id!); }} aria-current={selected === d.id ? 'true' : undefined}>
                  {d.type?.text ?? 'Document'}
                </button>
                <span className="sub">{d.description}</span>
                {flag && (
                  <Tip content="Counted by the sandbox from the report's flagged results, so abnormal reports stand out in the list. ELGA's registry entries do not carry this.">
                    <span className="flag" tabIndex={0}>
                      <TriangleAlert aria-hidden="true" size={14} />
                      {flag}
                    </span>
                  </Tip>
                )}
              </td>
              <td>
                {d.author?.[0]?.display}
              </td>
              <td>
                {voided ? (
                  <Status kind="void" />
                ) : (
                  <Tip content="Final: the author has signed off this document.">
                    <span className="src" tabIndex={0}>
                      Final
                    </span>
                  </Tip>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

