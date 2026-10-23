// What the engine needs from a FHIR server. The gateway implements it over HTTP against HAPI;
// the browser demo implements it with an in-memory store.

import type { TransactionId } from '../ihe';
import { excerpt, type NetLog } from './netlog';

export interface FhirResponse {
  status: number;
  body: string;
  contentType: string;
}

export interface CallOptions {
  body?: unknown;
  accept?: string;
  note?: string;
  /** Not written to the network log (start-up checks, reset housekeeping). */
  quiet?: boolean;
}

export interface FhirClient {
  call(transaction: TransactionId, action: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts?: CallOptions): Promise<FhirResponse>;
}

/** Writes one call to the network log, the same way for every FHIR client. */
export function logCall(
  log: NetLog,
  call: { transaction: TransactionId; action: string; method: string; path: string; status: number; ms: number; at: string; body: string },
  opts: CallOptions,
): void {
  if (opts.quiet) return;
  const shown = call.method === 'GET' ? call.body : JSON.stringify(opts.body, null, 2);
  log.add({
    action: call.action,
    at: call.at,
    transaction: call.transaction,
    method: call.method,
    path: `/fhir/${call.path}`,
    status: call.status,
    ms: call.ms,
    note: opts.note,
    excerpt: shown ? excerpt(prettyJson(shown)) : undefined,
  });
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
