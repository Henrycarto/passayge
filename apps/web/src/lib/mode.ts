/** True in the static demo build (VITE_DEMO=1): the engine runs in the browser, without HAPI. */
export const DEMO = import.meta.env.VITE_DEMO === '1';

export const DEMO_LABEL = 'Demo mode: runs in your browser; the full stack runs with Docker or Codespaces.';
