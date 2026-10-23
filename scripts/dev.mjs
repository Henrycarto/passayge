// Starts the gateway and the web dev server together (works in PowerShell and bash).
// HAPI must be running: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d hapi
import { spawn } from 'node:child_process';

const run = (ws) => spawn('npm', ['run', 'dev', '-w', ws], { stdio: 'inherit', shell: true });
const children = [run('@passayge/gateway'), run('@passayge/web')];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
