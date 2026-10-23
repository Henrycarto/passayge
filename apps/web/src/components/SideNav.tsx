import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, ScrollText, Search, UsersRound } from 'lucide-react';
import type { Patient } from 'fhir/r4';
import { api } from '@/lib/api';
import { ageOn, fmtDay } from '@/lib/format';
import { onLinkClick, type Route } from '@/lib/route';
import { useSession } from '@/lib/session';
import { Tip } from './Tooltip';

/** Turns one search box into PDQm parameters: digits are an SVNR, a date is a birth date, anything else a family name. */
export function toQuery(input: string): Record<string, string> | undefined {
  const v = input.trim();
  if (!v) return undefined;
  if (/^\d[\d\s]{8,}\d$/.test(v)) return { identifier: v.replace(/\s/g, '') };
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (de) return { birthdate: `${de[3]}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}` };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { birthdate: v };
  const parts = v.split(/\s+/);
  return parts.length > 1 ? { family: parts[0]!, given: parts.slice(1).join(' ') } : { family: v };
}

export function SideNav({ route, onGlossary }: { route: Route; onGlossary: () => void }) {
  const { now, version } = useSession();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>();
  const [message, setMessage] = useState<string>();

  // `n` counts submissions, so searching the same text again runs again.
  const [submitted, setSubmitted] = useState({ text: '', n: 0 });

  // Runs the search on submit, and again after every sandbox change. Nothing runs before the first search.
  useEffect(() => {
    if (submitted.n === 0) return;
    let live = true;
    const query = toQuery(submitted.text);
    const run = query ? api.searchPatients(query) : Promise.reject(new Error('Type a name, a date of birth (14.03.1962) or a social security number.'));
    run
      .then((b) => {
        if (!live) return;
        const list = (b.entry ?? []).map((e) => e.resource as Patient);
        setResults(list);
        setMessage(list.length ? `${list.length} patient${list.length === 1 ? '' : 's'} found` : 'No patient found. Check the spelling or search by date of birth.');
      })
      .catch((e: unknown) => {
        if (!live) return;
        setResults(undefined);
        setMessage((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [submitted, version]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted((s) => ({ text: q, n: s.n + 1 }));
  };

  const current = route.name === 'patient' ? route.id : undefined;
  const logPath = current ? `/log?patient=${current}` : '/log';

  return (
    <nav className="side" aria-label="Main">
      <div className="nav">
        <a href="/" aria-current={route.name === 'home' || route.name === 'patient' ? 'page' : undefined} onClick={onLinkClick(current ? `/patients/${current}` : '/')}>
          <UsersRound aria-hidden="true" size={16} />
          Patients <kbd className="k">G P</kbd>
        </a>
        <a href={logPath} aria-current={route.name === 'log' ? 'page' : undefined} onClick={onLinkClick(logPath)} data-tour="nav-log">
          <ScrollText aria-hidden="true" size={16} />
          <span className="long">Audit and network log</span>
          <span className="short">Log</span> <kbd className="k">G L</kbd>
        </a>
        <a href="#glossary" onClick={(e) => { e.preventDefault(); onGlossary(); }}>
          <BookOpen aria-hidden="true" size={16} />
          Glossary <kbd className="k">?</kbd>
        </a>
      </div>
      <form className="search-form" role="search" onSubmit={onSubmit} data-tour="search">
        <Tip content="Search by family name, date of birth (14.03.1962) or social security number. Runs ITI-78, a FHIR patient search. Shortcut: /">
          <label className="search-box">
            <Search aria-hidden="true" size={16} />
            <span className="sr-only">Find a patient</span>
            <input id="patient-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a patient" autoComplete="off" />
            <kbd aria-hidden="true">/</kbd>
          </label>
        </Tip>
      </form>
      {message && <h2 aria-live="polite">{message}</h2>}
      {results && (
        <ul className="results">
          {results.map((p) => {
            const n = p.name?.[0];
            const path = `/patients/${p.id}`;
            return (
              <li key={p.id}>
                <a className="result" href={path} aria-current={current === p.id ? 'page' : undefined} onClick={onLinkClick(path)}>
                  <b>{n?.family?.toUpperCase()}, {n?.given?.join(' ')}</b>
                  <span className="muted num">{p.birthDate ? `${ageOn(p.birthDate, now)} y` : ''}</span>
                  <small className="num">Born {p.birthDate ? fmtDay(p.birthDate) : 'not recorded'}, {p.address?.[0]?.city}</small>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
