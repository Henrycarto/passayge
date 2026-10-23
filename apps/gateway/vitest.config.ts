import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/**/*.test.ts'], exclude: ['tests/**/*.integration.test.ts'] } },
      // Needs a running HAPI FHIR server: HAPI_URL (default http://localhost:8091/fhir).
      { test: { name: 'integration', include: ['tests/**/*.integration.test.ts'], testTimeout: 120_000, hookTimeout: 300_000 } },
    ],
  },
});
