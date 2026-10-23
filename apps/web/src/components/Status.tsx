import { Check, CircleSlash, ClockAlert, Lock, LockOpen } from 'lucide-react';
import type { AuditOutcome } from '@passayge/core';
import { Tip } from './Tooltip';
import { GLOSSARY_BY_ID } from '@passayge/core';

export type StatusKind = AuditOutcome;

/** The one status vocabulary: the same word, icon and colour on every screen. */
export const STATUS: Record<StatusKind, { word: string; icon: typeof Lock; term: string }> = {
  granted: { word: 'Granted', icon: LockOpen, term: 'granted' },
  denied: { word: 'Denied', icon: Lock, term: 'denied' },
  expired: { word: 'Expired', icon: ClockAlert, term: 'expired' },
  void: { word: 'Entered in error', icon: CircleSlash, term: 'entered-in-error' },
  recorded: { word: 'Recorded', icon: Check, term: 'recorded' },
};

export function Status({ kind, word }: { kind: StatusKind; word?: string }) {
  const s = STATUS[kind];
  const Icon = s.icon;
  return (
    <Tip content={GLOSSARY_BY_ID[s.term]?.explain ?? s.word}>
      <span className={`status ${kind}`} tabIndex={0}>
        <Icon aria-hidden="true" />
        {word ?? s.word}
      </span>
    </Tip>
  );
}
