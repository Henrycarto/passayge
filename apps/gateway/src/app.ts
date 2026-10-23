// The sandbox gateway: the engine from @passayge/core served over HTTP, in front of a HAPI FHIR
// server, plus the built web client. The browser only ever talks to this gateway.

import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Engine, NetLog, SIM_START, SimClock, State } from '@passayge/core';
import { guardedFetch, type Fetch } from './egress';
import { Hapi } from './hapi';

export { State };

export interface AppOptions {
  hapiBase: string;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: Fetch;
  clock?: SimClock;
  webDist?: string;
  logger?: boolean;
}

export interface Sandbox {
  app: FastifyInstance;
  clock: SimClock;
  netlog: NetLog;
  hapi: Hapi;
  engine: Engine;
  state: State;
}

export function buildApp(opts: AppOptions): Sandbox {
  const clock = opts.clock ?? new SimClock(SIM_START);
  const netlog = new NetLog();
  const hapi = new Hapi(opts.hapiBase, guardedFetch([opts.hapiBase], opts.fetch), netlog, clock);
  const app = Fastify({ logger: opts.logger ?? false });
  const engine = new Engine({ fhir: hapi, clock, netlog, onAuditError: (status, body) => app.log.error({ status, body }, 'audit write failed') });

  const handle = async (req: FastifyRequest, reply: FastifyReply) => {
    const r = await engine.handle({ method: req.method, url: req.url, body: req.body });
    return reply.code(r.status).type(r.type).send(r.body);
  };
  for (const url of ['/api/*', '/fhir/*']) app.route({ method: ['GET', 'POST', 'PUT', 'DELETE'], url, handler: handle });

  if (opts.webDist && existsSync(opts.webDist)) {
    app.register(fastifyStatic, { root: opts.webDist, wildcard: false });
    app.setNotFoundHandler((_req, reply: FastifyReply) => reply.sendFile('index.html'));
  }

  return { app, clock, netlog, hapi, engine, state: engine.state };
}
