import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { seed, waitForHapi } from './seed';

const hapiBase = process.env.HAPI_URL ?? 'http://localhost:8091/fhir';
const port = Number(process.env.PORT ?? 8080);
// Local development binds to this machine only; the container sets HOST=0.0.0.0.
const host = process.env.HOST ?? '127.0.0.1';
const webDist = process.env.WEB_DIST ?? fileURLToPath(new URL('../../web/dist', import.meta.url));

const { app, hapi } = buildApp({ hapiBase, webDist, logger: true });

await waitForHapi(hapi);
await seed(hapi);
await app.listen({ host, port });
app.log.info(`Passayge gateway on http://localhost:${port} (FHIR server ${hapiBase})`);
