// HTTP client for the sandbox HAPI FHIR server. Every call goes through the egress guard and is
// written to the network log with its IHE transaction.

import type { TransactionId } from '@passayge/core';
import type { SimClock } from './clock';
import type { Fetch } from './egress';
import { excerpt, type NetLog } from './netlog';

/** How the sandbox identifies itself. Never personal data (see scripts/check-personal-data.mjs). */
export const USER_AGENT = 'Passayge/0.1 (https://henrycarto.com)';

export interface HapiResponse {
  status: number;
  body: string;
  contentType: string;
}

export class Hapi {
  constructor(
    private readonly base: string,
    private readonly fetch: Fetch,
    private readonly log: NetLog,
    private readonly clock: SimClock,
  ) {}

  async call(
    transaction: TransactionId,
    action: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    opts: { body?: unknown; accept?: string; note?: string; quiet?: boolean } = {},
  ): Promise<HapiResponse> {
    const started = performance.now();
    const at = this.clock.now().toISOString();
    const res = await this.fetch(`${this.base}/${path}`, {
      method,
      headers: {
        'user-agent': USER_AGENT,
        // HAPI reuses identical search results for a minute by default; the audit log must be current.
        'cache-control': 'no-cache',
        accept: opts.accept ?? 'application/fhir+json',
        ...(opts.body !== undefined ? { 'content-type': 'application/fhir+json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.text();
    const ms = Math.round(performance.now() - started);
    if (!opts.quiet) {
      const shown = method === 'GET' ? body : JSON.stringify(opts.body, null, 2);
      this.log.add({
        action,
        at,
        transaction,
        method,
        path: `/fhir/${path}`,
        status: res.status,
        ms,
        note: opts.note,
        excerpt: shown ? excerpt(prettyJson(shown)) : undefined,
      });
    }
    return { status: res.status, body, contentType: res.headers.get('content-type') ?? '' };
  }

  async json<T>(transaction: TransactionId, action: string, path: string, note?: string): Promise<{ status: number; data: T }> {
    const r = await this.call(transaction, action, 'GET', path, { note });
    return { status: r.status, data: JSON.parse(r.body) as T };
  }
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
