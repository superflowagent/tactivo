import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export type Testimonial = {
  quote: string;
  name: string;
  designation?: string;
  src?: string;
};

export function AnimatedTestimonials({ testimonials, className }: { testimonials: Testimonial[]; className?: string }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const len = testimonials.length;
  const autoplayRef = React.useRef<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Autoplay + progress using requestAnimationFrame for smoother progress bar updates
  const AUTOPLAY_MS = 6000;
  const rafTimerRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  const pausedElapsedRef = React.useRef(0);
  const isPausedRef = React.useRef(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (reduce) return; // respect reduced motion

    let mounted = true;

    const step = (now: number) => {
      if (!mounted) return;
      if (isPausedRef.current) {
        rafTimerRef.current = requestAnimationFrame(step);
        return;
      }

      if (startTimeRef.current == null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current + (pausedElapsedRef.current || 0);
      const p = Math.min(elapsed / AUTOPLAY_MS, 1);
      setProgress(p);

      if (p >= 1) {
        setIndex((i) => (i + 1) % len);
        // reset
        startTimeRef.current = null;
        pausedElapsedRef.current = 0;
        setProgress(0);
      }

      rafTimerRef.current = requestAnimationFrame(step);
    };

    rafTimerRef.current = requestAnimationFrame(step);

    return () => {
      mounted = false;
      if (rafTimerRef.current != null) cancelAnimationFrame(rafTimerRef.current);
      rafTimerRef.current = null;
    };
  }, [len, reduce]);

  const pauseAutoplay = React.useCallback(() => {
    if (reduce) return;
    isPausedRef.current = true;
    // capture elapsed so far
    if (startTimeRef.current != null) {
      const now = performance.now();
      pausedElapsedRef.current = now - startTimeRef.current + (pausedElapsedRef.current || 0);
    }
  }, [reduce]);

  const resumeAutoplay = React.useCallback(() => {
    if (reduce) return;
    isPausedRef.current = false;
    // next RAF will continue from pausedElapsedRef
    startTimeRef.current = null;
  }, [reduce]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const prev = React.useCallback(() => {
    setIndex((i) => (i - 1 + len) % len);
    // reset progress and timers
    pausedElapsedRef.current = 0;
    startTimeRef.current = null;
    setProgress(0);
  }, [len]);

  const next = React.useCallback(() => {
    setIndex((i) => (i + 1) % len);
    // reset progress and timers
    pausedElapsedRef.current = 0;
    startTimeRef.current = null;
    setProgress(0);
  }, [len]);

  const testimonial = testimonials[index];

  return (
    <div className={cn('w-full', className)}>
      <div className="mx-auto max-w-7xl px-6">
        <div
          ref={containerRef}
          className="rounded-md p-6"
          onMouseEnter={() => {
            if (autoplayRef.current != null) {
              clearInterval(autoplayRef.current);
              autoplayRef.current = null;
            }
          }}
          onMouseLeave={() => {
            if (!reduce && autoplayRef.current == null) {
              autoplayRef.current = window.setInterval(() => {
                setIndex((i) => {
                  // reset progress/timers when autoplay advances
                  pausedElapsedRef.current = 0;
                  startTimeRef.current = null;
                  setProgress(0);
                  return (i + 1) % len;
                });
              }, 6000);
            }
          }}
        >
          <div className="flex flex-col md:flex-row items-center gap-8">

            <div className="max-w-4xl mx-auto">
              <motion.blockquote
                initial={reduce ? undefined : { opacity: 0, x: 16 }}
                animate={reduce ? undefined : { opacity: 1, x: 0 }}
                transition={{ duration: 0.45 }}
                className="text-lg leading-relaxed text-neutral-900 text-center md:text-left"
                aria-live="polite"
              >
                {testimonial ? `“${testimonial.quote}”` : null}
              </motion.blockquote>

              <div className="mt-6 flex items-center justify-center md:justify-start gap-4">
                <div className="flex-none">
                  {testimonial?.src ? (
                    <img src={testimonial.src} alt={testimonial.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted" />
                  )}
                </div>

                <div className="min-w-0 text-center md:text-left">
                  <div className="text-base font-semibold text-foreground">{testimonial?.name}</div>
                  {testimonial?.designation && <div className="text-sm text-muted-foreground">{testimonial.designation}</div>}
                </div>
              </div>

              {/* Progress bar (full width above controls) */}
              <div className="w-full mt-6">
                <div className="h-1 bg-transparent rounded-full overflow-hidden">
                  <div
                    className="h-full origin-left transition-transform"
                    style={{ transform: `scaleX(${progress})`, willChange: 'transform', background: 'var(--primary-gradient)' }}
                    aria-hidden
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    prev();
                    // reset progress
                    pausedElapsedRef.current = 0;
                    startTimeRef.current = null;
                    setProgress(0);
                  }}
                  onPointerDown={() => pauseAutoplay()}
                  onPointerUp={() => resumeAutoplay()}
                  aria-label="Anterior testimonio"
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/10 hover:bg-muted/20 text-foreground"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <button
                  onClick={() => {
                    next();
                    // reset progress
                    pausedElapsedRef.current = 0;
                    startTimeRef.current = null;
                    setProgress(0);
                  }}
                  onPointerDown={() => pauseAutoplay()}
                  onPointerUp={() => resumeAutoplay()}
                  aria-label="Siguiente testimonio"
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/10 hover:bg-muted/20 text-foreground"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>

                <div className="ml-4 flex items-center gap-3">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setIndex(i);
                        pausedElapsedRef.current = 0;
                        startTimeRef.current = null;
                        setProgress(0);
                      }}
                      onPointerDown={() => pauseAutoplay()}
                      onPointerUp={() => resumeAutoplay()}
                      aria-label={`Ir al testimonio ${i + 1}`}
                      className={`w-3 h-3 rounded-full transform transition ${i === index ? 'bg-foreground scale-110' : 'bg-slate-300 scale-100'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnimatedTestimonials;
