// HTTP client for the sandbox HAPI FHIR server. Every call goes through the egress guard and is
// written to the network log with its IHE transaction.

import { logCall, type CallOptions, type FhirClient, type FhirResponse, type NetLog, type SimClock, type TransactionId } from '@passayge/core';
import type { Fetch } from './egress';

/** How the sandbox identifies itself. Never personal data (see scripts/check-personal-data.mjs). */
export const USER_AGENT = 'Passayge/0.1 (https://henrycarto.com)';

export class Hapi implements FhirClient {
  constructor(
    private readonly base: string,
    private readonly fetch: Fetch,
    private readonly log: NetLog,
    private readonly clock: SimClock,
  ) {}

  async call(transaction: TransactionId, action: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: CallOptions = {}): Promise<FhirResponse> {
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
    logCall(this.log, { transaction, action, method, path, status: res.status, ms: Math.round(performance.now() - started), at, body }, opts);
    return { status: res.status, body, contentType: res.headers.get('content-type') ?? '' };
  }
}
