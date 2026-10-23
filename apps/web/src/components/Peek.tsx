import { useEffect, useState } from 'react';
import { Network } from 'lucide-react';
import { TRANSACTIONS } from '@passayge/core';
import { CHANGED, api, type NetEntry } from '@/lib/api';
import { onLinkClick } from '@/lib/route';
import { Tip } from './Tooltip';

/** The last network call, always visible at the foot of the chart. */
export function Peek() {
  const [last, setLast] = useState<NetEntry>();
  useEffect(() => {
    let timer = 0;
    const load = () => {
      window.clearTimeout(timer);
      // Wait for the call that changed things to finish writing its audit entry.
      timer = window.setTimeout(() => {
        api
          .network()
          .then((r) => setLast(r.entries.filter((e) => e.transaction !== 'ITI-20' && e.transaction !== 'ITI-81').at(-1)))
          .catch(() => undefined);
      }, 250);
    };
    load();
    window.addEventListener(CHANGED, load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CHANGED, load);
    };
  }, []);
  const t = last ? TRANSACTIONS[last.transaction] : undefined;
  return (
    <div className="peek" data-tour="peek">
      <Network aria-hidden="true" size={16} />
      <span>Last transaction</span>
      {last && t ? (
        <>
          <Tip content={t.explain}>
            <span className="ihe" tabIndex={0}>
              {t.code}
            </span>
          </Tip>
          <b>{t.name}</b>
          {t.elga && <span>In ELGA: {t.elga}</span>}
          <span className={last.status < 400 ? 'code-ok' : 'code-no'}>{last.status}</span>
          <span className="num">{last.ms} ms</span>
        </>
      ) : (
        <span>None yet</span>
      )}
      <span className="spacer" />
      <a href="/log/network" onClick={onLinkClick('/log/network')}>
        Open network log
      </a>
    </div>
  );
}
