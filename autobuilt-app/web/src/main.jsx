import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/global.css';
import App from './App.jsx';

// Without this, a browser (or a PWA someone added to their home screen)
// that already had an old service worker installed can keep serving a
// stale, broken JS bundle after a deploy indefinitely — the exact "Something
// went wrong" symptom that only manual cache-clearing fixed before. This
// makes a new deploy take over automatically: it registers with
// `immediate: true`, re-checks for updates whenever the app is reopened or
// regains focus, and force-reloads the one time control actually passes to
// the new version, so people self-heal onto the latest build just by using
// the app again rather than needing to know to clear their cache.
let reloadedForUpdate = false;
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (reloadedForUpdate) return;
  reloadedForUpdate = true;
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
