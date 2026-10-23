import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SessionProvider } from './lib/session';
import './styles.css';

// No StrictMode: it runs effects twice in development, and every request here is an audited access.
createRoot(document.getElementById('root')!).render(
  <SessionProvider>
    <App />
  </SessionProvider>,
);
