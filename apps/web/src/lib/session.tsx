// Session state: who is acting, the simulated clock, and a version that bumps after every change
// so screens reload their data.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Session } from './api';

interface SessionValue {
  session?: Session;
  /** Simulated now, ticking locally between server round trips. */
  now: Date;
  version: number;
  bump: () => void;
  setActor: (providerId: string) => Promise<void>;
  advance: (body: { days?: number; hours?: number }) => Promise<void>;
  reset: () => Promise<void>;
  error?: string;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>();
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    api
      .session()
      .then((s) => {
        if (!live) return;
        setSession(s);
        setOffset(Date.parse(s.now) - Date.now());
        setError(undefined);
      })
      .catch(() => live && setError('The sandbox gateway is not reachable. Start it with docker compose up, then reload.'));
    return () => {
      live = false;
    };
  }, [version]);

  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<SessionValue>(
    () => ({
      session,
      now: new Date(tick + offset),
      version,
      bump,
      error,
      setActor: async (providerId) => {
        await api.setActor(providerId);
        bump();
      },
      advance: async (body) => {
        const r = await api.advanceClock(body);
        setOffset(Date.parse(r.now) - Date.now());
        setTick(Date.now());
        bump();
      },
      reset: async () => {
        const r = await api.reset();
        setOffset(Date.parse(r.now) - Date.now());
        setTick(Date.now());
        bump();
      },
    }),
    [session, tick, offset, version, bump, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
