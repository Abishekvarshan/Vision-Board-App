
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// PWA / Service Worker registration.
// We register explicitly so we can set `type: 'module'` in dev.
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  // Avoid duplicate SW registrations during dev (React.StrictMode can trigger extra work).
  const w = window as any;
  if (!w.__VISIONFLOW_SW_REGISTERED__) {
    w.__VISIONFLOW_SW_REGISTERED__ = true;
    registerSW({
      immediate: true,
      // IMPORTANT: the dev service worker contains ESM imports, so it must be registered as a module.
      type: 'module',
    });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
