import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// In development the gateway runs on :8080; the client talks only to it, never to HAPI.
const gateway = process.env.GATEWAY_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': gateway, '/fhir': gateway } },
  build: { sourcemap: false, assetsInlineLimit: 0 },
});
