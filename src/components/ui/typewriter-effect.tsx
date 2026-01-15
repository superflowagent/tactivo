'use client';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type WordItem = { text: string; className?: string };

export function TypewriterEffectSmooth({
  words,
  className = '',
  interval = 1800,
  playOnce = false,
  onComplete,
}: {
  words: WordItem[];
  className?: string;
  interval?: number;
  playOnce?: boolean;
  onComplete?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!words || words.length === 0) return;
    let mounted = true;

    // Calculate a fade duration that scales with the requested interval.
    // Keep it bounded so it behaves well for both short and long intervals.
    const fadeMs = Math.min(260, Math.max(20, Math.floor(interval * 0.35)));

    if (playOnce) {
      // Schedule a sequence of timeouts to show each word once with cross-fade.
      const timeouts: number[] = [];

      const schedule = (i: number) => {
        if (!mounted) return;
        setIndex(i);
        setVisible(true);

        // Hide shortly before the next word (if any)
        if (i < words.length - 1) {
          const hideT = window.setTimeout(() => {
            if (!mounted) return;
            setVisible(false);
          }, Math.max(0, interval - fadeMs));
          timeouts.push(hideT);

          const nextT = window.setTimeout(() => {
            if (!mounted) return;
            schedule(i + 1);
          }, interval);
          timeouts.push(nextT);
        } else {
          // Last word: call onComplete after it has been visible for 'interval' ms
          const finishT = window.setTimeout(() => {
            if (!mounted) return;
            if (onComplete) onComplete();
          }, interval);
          timeouts.push(finishT);
        }
      };

      schedule(0);

      return () => {
        mounted = false;
        timeouts.forEach((t) => window.clearTimeout(t));
      };
    }

    const tick = () => {
      if (!mounted) return;
      setVisible(false);
      window.setTimeout(() => {
        if (!mounted) return;
        setIndex((i) => (i + 1) % words.length);
        setVisible(true);
      }, fadeMs); // cross-fade timing
    };

    const id = window.setInterval(tick, interval);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [words, interval, playOnce, onComplete]);

  if (!words || words.length === 0) return null;

  const current = words[index];

  return (
    <div className={cn('inline-block overflow-hidden align-middle', className)}>
      <span
        className={cn(
          'inline-block transition-transform duration-260 ease-in-out',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        )}
        aria-hidden={!visible}
      >
        <span className={cn(current.className || '')}>{current.text}</span>
      </span>
    </div>
  );
}

export default TypewriterEffectSmooth;
