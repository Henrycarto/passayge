// The network log: every call the sandbox makes, with the IHE transaction it implements.
// Calls made for one user action share an action id, so the audit view can show them together.

import type { TransactionId } from '@passayge/core';

export interface NetEntry {
  id: number;
  /** Groups the calls made for one user action. */
  action: string;
  /** Simulated time, ISO. */
  at: string;
  transaction: TransactionId;
  method: string;
  path: string;
  status: number;
  ms: number;
  /** A short excerpt of the request or response, for the detail view. */
  excerpt?: string;
  note?: string;
}

export class NetLog {
  private entries: NetEntry[] = [];
  private next = 1;

  constructor(private readonly capacity = 2000) {}

  add(e: Omit<NetEntry, 'id'>): NetEntry {
    const entry = { ...e, id: this.next++ };
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.shift();
    return entry;
  }

  /** Entries with an id greater than `after`, oldest first. */
  since(after = 0): NetEntry[] {
    return this.entries.filter((e) => e.id > after);
  }

  forAction(action: string): NetEntry[] {
    return this.entries.filter((e) => e.action === action);
  }

  clear(): void {
    this.entries = [];
  }
}

export function excerpt(text: string, max = 600): string {
  return text.length > max ? `${text.slice(0, max)}\n...` : text;
}
