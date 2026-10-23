import { CircleHelp, FlaskConical, Moon, RotateCcw, Sun } from 'lucide-react';
import { useSession } from '@/lib/session';
import { fmtWeekday, fmtTime } from '@/lib/format';
import { onLinkClick } from '@/lib/route';
import { Term, Tip } from './Tooltip';

export function TopBar({ theme, onTheme, onHelp, helpOpen }: { theme: 'light' | 'dark'; onTheme: () => void; onHelp: () => void; helpOpen: boolean }) {
  const { session, now, setActor, advance, reset } = useSession();
  return (
    <header className="topbar">
      <a href="/" className="wordmark" onClick={onLinkClick('/')}>
        {/* The Pass: assets/brand/icon.svg, drawn in the current text colour so it follows the theme. */}
        <svg className="mark" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9.5V8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1.5a2.5 2.5 0 0 0 0 5V16a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1.5a2.5 2.5 0 0 0 0-5z" />
          <path d="M15 7.5v9" strokeDasharray="0 3" />
        </svg>
        Passayge
      </a>
      <p className="sandbox">
        <FlaskConical aria-hidden="true" size={16} />
        <span>
          <strong>Simulation with synthetic data.</strong> Not connected to <Term id="elga">ELGA</Term>, the <Term id="ecard">e-card</Term> system or any real service.{' '}
          <a href="/about" onClick={onLinkClick('/about')}>About</a>
        </span>
      </p>
      <span className="spacer" />
      {session && (
        <div className="actor">
          <label htmlFor="actor">Acting as</label>
          <Tip content="Switch between the synthetic doctors, hospital and pharmacy to see how the same rules give each a different answer.">
            <select id="actor" className="input" value={session.actor.id} onChange={(e) => void setActor(e.target.value)} data-tour="actor">
              {session.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.person}, {p.label}
                </option>
              ))}
            </select>
          </Tip>
        </div>
      )}
      <div className="clock">
        <div>
          <span className="lbl">Simulated time</span>
          <time dateTime={now.toISOString()}>
            {fmtWeekday(now)}, {fmtTime(now)}
          </time>
        </div>
        <Tip content="Move the sandbox clock one day ahead.">
          <button type="button" className="btn sm" onClick={() => void advance({ days: 1 })}>+1 day</button>
        </Tip>
        <Tip content="Move the clock 28 days ahead: the pharmacy and vaccination windows end.">
          <button type="button" className="btn sm" onClick={() => void advance({ days: 28 })}>+28 days</button>
        </Tip>
        <Tip content="Start again: the clock, contact confirmations, settings and the session's audit entries go back to the beginning.">
          <button type="button" className="btn sm icon" aria-label="Reset the sandbox" onClick={() => void reset()}>
            <RotateCcw aria-hidden="true" size={16} />
          </button>
        </Tip>
      </div>
      <Tip content={theme === 'dark' ? 'Switch to the light theme.' : 'Switch to the dark theme.'}>
        <button type="button" className="btn icon ghost" aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={onTheme}>
          {theme === 'dark' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
        </button>
      </Tip>
      <Tip content="Help: the tour, the glossary and what Passayge is. Shortcut: ?">
        <button type="button" className="btn icon ghost" aria-label="Help" aria-haspopup="menu" aria-expanded={helpOpen} onClick={onHelp} data-help-button>
          <CircleHelp aria-hidden="true" size={20} />
        </button>
      </Tip>
    </header>
  );
}
