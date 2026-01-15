import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Dev helper: detect long 'message' event handling by measuring time between event and next macrotask.
if (process.env.NODE_ENV !== 'production') {
  window.addEventListener('message', (e) => {
    const start = performance.now();
    setTimeout(() => {
      const dur = performance.now() - start;
      if (dur > 80) {
        // Log a concise warning with event data to help find the source of long message handlers
        // eslint-disable-next-line no-console
        console.warn(`[perf-dev] 'message' handler took ${dur.toFixed(1)}ms`, {
          data: (e && (e as any).data) || null,
          origin: (e && (e as any).origin) || null,
        });
      }
    }, 0);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
