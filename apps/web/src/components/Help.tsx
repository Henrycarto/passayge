import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Info, Route as RouteIcon, X } from 'lucide-react';
import { GLOSSARY } from '@passayge/core';
import { navigate } from '@/lib/route';

export function HelpMenu({ onClose, onTour, onGlossary }: { onClose: () => void; onTour: () => void; onGlossary: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest('[data-help-button]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);
  const item = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <div className="menu" role="menu" aria-label="Help" ref={ref}>
      <button role="menuitem" onClick={item(onTour)}>
        <RouteIcon aria-hidden="true" size={16} /> Take the tour
      </button>
      <button role="menuitem" onClick={item(onGlossary)}>
        <BookOpen aria-hidden="true" size={16} /> Glossary
      </button>
      <button role="menuitem" onClick={item(() => navigate('/about'))}>
        <Info aria-hidden="true" size={16} /> About Passayge
      </button>
    </div>
  );
}

export function Glossary({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const terms = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
    return s ? list.filter((t) => `${t.term} ${t.de ?? ''} ${t.explain}`.toLowerCase().includes(s)) : list;
  }, [q]);
  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="glossary-h">
      <div className="drawer-head">
        <h2 id="glossary-h">Glossary</h2>
        <button type="button" className="btn icon ghost" aria-label="Close the glossary" onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="drawer-body">
        <label className="search-box">
          <span className="sr-only">Filter terms</span>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter terms" />
        </label>
        <p className="src" aria-live="polite">
          {terms.length} of {GLOSSARY.length} terms. Official German terms in brackets.
        </p>
        <ul className="gloss">
          {terms.map((t) => (
            <li key={t.id}>
              <b>
                {t.term}
                {t.de ? <span className="de"> ({t.de})</span> : null}
              </b>
              <p>{t.explain}</p>
              {t.source ? (
                <a className="src" href={t.source} target="_blank" rel="noreferrer">
                  Source
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
