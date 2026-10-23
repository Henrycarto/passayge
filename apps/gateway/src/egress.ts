// The only way the gateway talks to the network. Every outbound request must go to an allowed
// origin (the sandbox's own HAPI server); anything else throws before a socket is opened.
// Passayge never contacts ELGA, the e-card system or any other real service.

export class EgressBlockedError extends Error {
  constructor(public readonly url: string) {
    super(`Blocked outbound request to ${url}: only the sandbox FHIR server is allowed.`);
    this.name = 'EgressBlockedError';
  }
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function guardedFetch(allowedOrigins: readonly string[], inner: Fetch = (i, o) => fetch(i, o)): Fetch {
  const allowed = new Set(allowedOrigins.map((o) => new URL(o).origin));
  return async (input, init) => {
    let origin: string;
    try {
      origin = new URL(input).origin;
    } catch {
      throw new EgressBlockedError(input);
    }
    if (!allowed.has(origin)) throw new EgressBlockedError(input);
    return inner(input, init);
  };
}
