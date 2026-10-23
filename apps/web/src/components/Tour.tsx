// First-visit tour: five steps, anchored to real controls, never covering the screen with an
// overlay and never trapping focus. Skip, Escape or finishing marks it done; the help menu
// reopens it.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { navigate } from '@/lib/route';

export const TOUR_KEY = 'passayge.tour.done';

interface Step {
  target: string;
  title: string;
  body: string;
  /** Called when the step opens, e.g. to open a patient so the next anchor exists. */
  before?: () => void;
}

export const STEPS: Step[] = [
  { target: 'search', title: 'Find a patient', body: 'Search by name, date of birth or social security number. Every patient here is synthetic. The search is IHE ITI-78, a FHIR patient query.' },
  { target: 'insert-card', title: 'Insert the e-card', body: 'This records a contact confirmation: doctors can then open the records for 90 days, pharmacies for 28. The card is simulated.', before: () => { if (!location.pathname.startsWith('/patients/')) navigate('/patients/pas-theresia'); } },
  { target: 'records', title: 'Open documents', body: 'Documents, medication and vaccinations each have their own window. A locked tab says why and what to do next.' },
  { target: 'nav-log', title: 'Read the audit log', body: 'Every search, opening and refusal is logged with time, person, provider and the rule that decided it.' },
  { target: 'peek', title: 'See the network view', body: 'Each call shows the IHE transaction the sandbox used and the ELGA transaction it stands in for.' },
];

export function readTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

function markDone() {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    // Private mode: the tour simply shows again next time.
  }
}

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 64, left: 16 });
  const step = STEPS[i]!;

  const close = () => {
    markDone();
    document.querySelectorAll('[data-tour-target]').forEach((el) => el.removeAttribute('data-tour-target'));
    onClose();
  };

  useEffect(() => {
    step.before?.();
  }, [step]);

  // Find the anchor (it may appear a moment later, after navigation) and place the card next to it.
  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    const place = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      document.querySelectorAll('[data-tour-target]').forEach((x) => x.removeAttribute('data-tour-target'));
      const c = card.current;
      if (!el || !c) {
        if (tries++ < 60) frame = requestAnimationFrame(place);
        return;
      }
      el.setAttribute('data-tour-target', 'true');
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      const h = c.offsetHeight;
      const w = c.offsetWidth;
      const below = r.bottom + 12 + h < window.innerHeight;
      const top = below ? r.bottom + 12 : Math.max(8, r.top - 12 - h);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      setPos({ top, left });
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [i, step.target]);

  useEffect(() => {
    card.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={card} className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title" style={{ top: pos.top, left: pos.left }}>
      <div className="dots" aria-hidden="true">
        {STEPS.map((_, k) => (
          <i key={k} className={k <= i ? 'on' : ''} />
        ))}
      </div>
      <div className="step">
        Step {i + 1} of {STEPS.length}
      </div>
      <h2 id="tour-title" tabIndex={-1}>
        {step.title}
      </h2>
      <p>{step.body}</p>
      <div className="row">
        <button type="button" className="btn ghost sm" onClick={close}>
          Skip tour
        </button>
        <span className="spacer" />
        {i > 0 && (
          <button type="button" className="btn sm" onClick={() => setI(i - 1)}>
            Back
          </button>
        )}
        {i < STEPS.length - 1 ? (
          <button type="button" className="btn sm primary" onClick={() => setI(i + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className="btn sm primary" onClick={close}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
