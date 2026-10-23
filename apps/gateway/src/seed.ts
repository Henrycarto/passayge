// Waits for HAPI and loads the synthetic world into it (the seeding itself lives in core, shared
// with the browser demo).

import { clearSessionAudit, seedFhir } from '@passayge/core';
import type { Hapi } from './hapi';

export { clearSessionAudit };
export const seed = (hapi: Hapi) => seedFhir(hapi);

export async function waitForHapi(hapi: Hapi, timeoutMs = 240_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await hapi.call('ITI-78', 'startup', 'GET', 'metadata', { quiet: true });
      if (r.status === 200) return;
    } catch {
      // HAPI is still starting.
    }
    if (Date.now() > until) throw new Error('HAPI FHIR did not become ready in time.');
    await new Promise((r) => setTimeout(r, 2000));
  }
}
