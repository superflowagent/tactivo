'use client';
import React from 'react';
import { cn } from '@/lib/utils';

export function CardContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('relative', className)}>{children}</div>;
}

import { useRef, useState } from 'react';

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1

    const rotateY = (px - 0.5) * 12; // degrees
    const rotateX = -(py - 0.5) * 8; // degrees
    const scale = 1.02;

    const shadowY = Math.round(rotateX * 1.6 + 6);
    const newStyle: React.CSSProperties = {
      transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
      boxShadow: `0 ${shadowY}px ${Math.abs(shadowY) + 18}px rgba(15,23,42,0.12)`,
      transition: 'transform 120ms ease, box-shadow 120ms ease',
      transformStyle: 'preserve-3d',
    };
    setStyle(newStyle);
  }

  function onLeave() {
    setStyle({
      transform: 'none',
      boxShadow: 'none',
      transition: 'transform 240ms ease, box-shadow 240ms ease',
    });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        'group/card relative rounded-xl p-0 transition-transform duration-200 transform-gpu',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardItem<T extends React.ElementType = 'div'>({
  children,
  className,
  translateZ,
  as,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  translateZ?: number | string;
  as?: T;
} & React.ComponentPropsWithoutRef<T>) {
  const Comp: any = as || 'div';
  const tz = translateZ ? String(translateZ) : '0';
  const style = {
    transform: `translateZ(${tz}px)`,
    transition: 'transform 220ms cubic-bezier(.2,.9,.2,1)',
    transformStyle: 'preserve-3d' as const,
  };

  return (
    <Comp className={cn('card-item', className)} style={style} {...rest}>
      {children}
    </Comp>
  );
}

export default CardContainer;
