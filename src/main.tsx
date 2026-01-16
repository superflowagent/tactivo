import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Dev helper: detect long 'message' event handling by measuring time between event and next macrotask.
if (process.env.NODE_ENV !== 'production') {
  const isIgnoredMessage = (data: any) => {
    if (!data) return false;
    // Ignore React DevTools hook/messages and Vite HMR pings which are noisy and external
    if (typeof data.source === 'string' && data.source.includes('react-devtools')) return true;
    if (data.source === 'react-devtools-hook') return true;
    if (data.source === 'react-devtools-content-script') return true;
    if (data.source === 'react-devtools-backend-manager') return true;
    if (typeof data.type === 'string' && data.type.startsWith('vite')) return true;
    return false;
  };

  let _lastMessageWarnAt = 0;
  window.addEventListener('message', (e) => {
    const data = (e && (e as any).data) || null;
    if (isIgnoredMessage(data)) return; // skip noisy external messages

    const start = performance.now();
    setTimeout(() => {
      const dur = performance.now() - start;
      if (dur > 120) {
        const now = Date.now();
        // rate limit message handler warnings so they don't spam the console
        if (now - _lastMessageWarnAt > 2000) {
          _lastMessageWarnAt = now;
          // Log a concise warning with event data to help find the source of long message handlers
          console.warn(`[perf-dev] 'message' handler took ${dur.toFixed(1)}ms`, {
            data: data,
            origin: (e && (e as any).origin) || null,
          });
        }
      }
    }, 0);
  });

  // Dev-only: detect frequent layout reads (getBoundingClientRect) per frame to find reflow hot paths
  (function installLayoutReadDetector() {
    const original = Element.prototype.getBoundingClientRect;
    let count = 0;
    let sampleStack: string | null = null;

    Element.prototype.getBoundingClientRect = function () {
      count++;
      if (!sampleStack && Error && (Error as any).captureStackTrace) {
        try {
          const err = new Error();
          sampleStack = err.stack ? err.stack.toString() : String(err);
        } catch {
          sampleStack = null;
        }
      }
      return original.apply(this);
    };

    // Run the check less often, ignore known noisy stacks, dedupe and rate-limit logs to avoid spam.
    // Evaluate every 60 frames (~1s at 60fps) and raise threshold for reporting bursts.
    let frameCounter = 0;
    let lastLoggedSample: string | null = null;
    let lastLoggedAt = 0;
    const LOG_COOLDOWN_MS = 10_000; // 10s
    const STACK_IGNORED_PATTERNS = ['react-devtools', 'installhook', '.vite/deps'];

    const raf = () => {
      frameCounter++;
      if (frameCounter % 60 === 0) {
        if (count > 500 && !document.hidden) {
          const stack = sampleStack || '';
          const lower = stack.toLowerCase();
          const isIgnoredStack = STACK_IGNORED_PATTERNS.some((p) => lower.includes(p));
          const now = Date.now();
          if (!isIgnoredStack && (stack !== lastLoggedSample || now - lastLoggedAt > LOG_COOLDOWN_MS)) {
            lastLoggedSample = stack;
            lastLoggedAt = now;

            console.warn(`[perf-dev] High layout reads detected: ${count} getBoundingClientRect calls in last sample`, {
              sampleStack: stack,
            });
          }
        }
        count = 0;
        sampleStack = null;
      }
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // Restore on hot-reload / unload
    if (typeof module !== 'undefined' && (module as any).hot && (module as any).hot.dispose) {
      (module as any).hot.dispose(() => {
        Element.prototype.getBoundingClientRect = original;
      });
    }
    window.addEventListener('beforeunload', () => {
      Element.prototype.getBoundingClientRect = original;
    });
  })();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
