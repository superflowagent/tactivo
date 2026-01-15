'use client';
import { cn } from '@/lib/utils';
import { useMotionValue, motion, useMotionTemplate } from 'motion/react';
import React from 'react';

export const HeroHighlight = ({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) => {
  let mouseX = useMotionValue(0);
  let mouseY = useMotionValue(0);

  // Cache element rect and batch mousemove handling to rAF to avoid layout thrashing
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const rectRef = React.useRef<DOMRect | null>(null);
  const posRef = React.useRef({ x: 0, y: 0 });
  const rafScheduled = React.useRef(false);

  React.useEffect(() => {
    const onResize = () => {
      rectRef.current = null;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // SVG patterns for different states and themes
  const dotPatterns = {
    light: {
      default: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='16' height='16' fill='none'%3E%3Ccircle fill='%23d4d4d4' id='pattern-circle' cx='10' cy='10' r='2.5'%3E%3C/circle%3E%3C/svg%3E")`,
      hover: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='16' height='16' fill='none'%3E%3Ccircle fill='%236366f1' id='pattern-circle' cx='10' cy='10' r='4'%3E%3C/circle%3E%3C/svg%3E")`,
    },
    dark: {
      default: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='16' height='16' fill='none'%3E%3Ccircle fill='%23404040' id='pattern-circle' cx='10' cy='10' r='2.5'%3E%3C/circle%3E%3C/svg%3E")`,
      hover: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='16' height='16' fill='none'%3E%3Ccircle fill='%238183f4' id='pattern-circle' cx='10' cy='10' r='4'%3E%3C/circle%3E%3C/svg%3E")`,
    },
  };

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    containerRef.current = e.currentTarget;
    rectRef.current = containerRef.current.getBoundingClientRect();
  }

  function handleMouseLeave() {
    rectRef.current = null;
    containerRef.current = null;
  }

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent<HTMLDivElement>) {
    // store latest coords and batch the work in rAF
    posRef.current = { x: clientX, y: clientY };
    if (!containerRef.current && currentTarget) containerRef.current = currentTarget;

    if (rafScheduled.current) return;
    rafScheduled.current = true;

    requestAnimationFrame(() => {
      rafScheduled.current = false;
      const el = containerRef.current;
      if (!el) return;
      if (!rectRef.current) rectRef.current = el.getBoundingClientRect();
      const { left, top } = rectRef.current;
      mouseX.set(posRef.current.x - left);
      mouseY.set(posRef.current.y - top);
    });
  }
  return (
    <div
      className={cn(
        'group relative w-full bg-white dark:bg-black py-12 md:py-20',
        containerClassName
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{ backgroundImage: dotPatterns.light.default }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ backgroundImage: dotPatterns.dark.default }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-60 dark:hidden"
        style={{
          backgroundImage: dotPatterns.light.hover,
          WebkitMaskImage: useMotionTemplate`
            radial-gradient(
              200px circle at ${mouseX}px ${mouseY}px,
              rgba(0,0,0,0.8) 0%,
              transparent 100%
            )
          `,
          maskImage: useMotionTemplate`
            radial-gradient(
              200px circle at ${mouseX}px ${mouseY}px,
              rgba(0,0,0,0.8) 0%,
              transparent 100%
            )
          `,
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 hidden opacity-0 transition duration-500 group-hover:opacity-60 dark:block"
        style={{
          backgroundImage: dotPatterns.dark.hover,
          WebkitMaskImage: useMotionTemplate`
            radial-gradient(
              200px circle at ${mouseX}px ${mouseY}px,
              rgba(0,0,0,0.8) 0%,
              transparent 100%
            )
          `,
          maskImage: useMotionTemplate`
            radial-gradient(
              200px circle at ${mouseX}px ${mouseY}px,
              rgba(0,0,0,0.8) 0%,
              transparent 100%
            )
          `,
        }}
      />

      <div className={cn('relative z-20 w-full', className)}>{children}</div>
    </div>
  );
};

export const Highlight = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.span
      initial={{
        backgroundSize: '0% 100%',
      }}
      animate={{
        backgroundSize: '100% 100%',
      }}
      transition={{
        duration: 2,
        ease: 'linear',
        delay: 0.5,
      }}
      style={{
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left center',
        backgroundImage: 'var(--primary-gradient)',
        display: 'inline',
      }}
      className={cn(`relative inline-block rounded-lg px-1 pb-1`, className)}
    >
      {children}
    </motion.span>
  );
};
