import { useCallback, useEffect, useRef, useState } from 'react';
import { navigate, useRoute } from '@/lib/route';
import { useSession } from '@/lib/session';
import { Glossary, HelpMenu } from '@/components/Help';
import { SideNav } from '@/components/SideNav';
import { TopBar } from '@/components/TopBar';
import { Tour, readTourDone } from '@/components/Tour';
import { AboutPage } from '@/pages/AboutPage';
import { HomePage } from '@/pages/HomePage';
import { LAST_PATIENT, LogPage } from '@/pages/LogPage';
import { PatientPage } from '@/pages/PatientPage';

type Theme = 'light' | 'dark';
const THEME_KEY = 'passayge.theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage blocked: follow the system.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const route = useRoute();
  const { error } = useSession();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [menu, setMenu] = useState(false);
  const [glossary, setGlossary] = useState(false);
  const [tour, setTour] = useState(() => !readTourDone());
  const pendingG = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (route.name === 'patient') sessionStorage.setItem(LAST_PATIENT, route.id);
    const title = route.name === 'log' ? 'Audit and network log' : route.name === 'about' ? 'About' : route.name === 'patient' ? 'Patient' : 'Find a patient';
    document.title = `${title} | Passayge`;
  }, [route]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Not saved; the choice lasts for this visit.
      }
      return next;
    });
  }, []);

  // Keyboard: / search, G then P patients, G then L log, ? help.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('patient-search')?.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setMenu((m) => !m);
      } else if (e.key === 'g') {
        pendingG.current = Date.now();
      } else if (Date.now() - pendingG.current < 1000 && (e.key === 'p' || e.key === 'l')) {
        pendingG.current = 0;
        const last = sessionStorage.getItem(LAST_PATIENT);
        if (e.key === 'p') navigate(last ? `/patients/${last}` : '/');
        else navigate(last ? `/log?patient=${last}` : '/log');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <a className="sr-only" href="#main">
        Skip to main content
      </a>
      <TopBar theme={theme} onTheme={toggleTheme} onHelp={() => setMenu((m) => !m)} helpOpen={menu} />
      <SideNav route={route} onGlossary={() => setGlossary(true)} />
      <main id="main" tabIndex={-1}>
        {error ? (
          <div className="page" role="alert">
            <h1>The sandbox is not running</h1>
            <p>{error}</p>
          </div>
        ) : route.name === 'patient' ? (
          <PatientPage key={route.id} id={route.id} />
        ) : route.name === 'log' ? (
          <LogPage tab={route.tab} />
        ) : route.name === 'about' ? (
          <AboutPage />
        ) : (
          <HomePage />
        )}
      </main>
      {menu && <HelpMenu onClose={() => setMenu(false)} onTour={() => setTour(true)} onGlossary={() => setGlossary(true)} />}
      {glossary && <Glossary onClose={() => setGlossary(false)} />}
      {tour && <Tour onClose={() => setTour(false)} />}
    </div>
  );
}
