import React, { useRef, useEffect, useImperativeHandle } from 'react';

export type ConfettiRef = {
    fire: (opts?: { x?: number; y?: number; clientX?: number; clientY?: number; count?: number }) => void;
};

type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    size: number;
    color: string;
};

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export const Confetti = React.forwardRef<ConfettiRef, React.HTMLAttributes<HTMLDivElement>>(
    ({ className }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement | null>(null);
        const animRef = useRef<number | null>(null);
        const particlesRef = useRef<Particle[]>([]);
        const runningRef = useRef(false);

        // Respect user motion preference and allow reducing particles
        const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
        React.useEffect(() => {
            if (typeof window === 'undefined') return;
            const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
            setPrefersReducedMotion(mq.matches);
            const handler = () => setPrefersReducedMotion(mq.matches);
            mq.addEventListener?.('change', handler);
            return () => mq.removeEventListener?.('change', handler);
        }, []);

        useImperativeHandle(ref, () => ({
            fire: (opts = {}) => {
                if (prefersReducedMotion) return; // don't fire if user prefers reduced motion

                const canvas = canvasRef.current;
                if (!canvas) return;

                const count = opts.count ?? 8; // fewer particles by default

                // Helper to actually add particles (accepts local canvas coords)
                const addParticles = (localX: number, localY: number) => {
                    for (let i = 0; i < count; i++) {
                        // narrower upward spread for subtle effect
                        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
                        const speed = 1 + Math.random() * 3;
                        const ttl = 30 + Math.random() * 40;
                        particlesRef.current.push({
                            x: localX,
                            y: localY,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 1.5,
                            life: ttl,
                            ttl,
                            size: 3 + Math.random() * 4,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        });
                    }
                    start();
                };

                // If client coordinates are provided, avoid synchronous layout read by scheduling
                // a requestAnimationFrame to read bounding rect once and then add particles.
                if (typeof opts.clientX === 'number' || typeof opts.clientY === 'number') {
                    pendingFiresRef.current.push({ clientX: opts.clientX, clientY: opts.clientY, count });
                    scheduleProcessPending();
                    return;
                }

                // Otherwise, if x/y are in local canvas coordinates, use them directly
                const localX = opts.x ?? (canvas.width / (window.devicePixelRatio || 1)) / 2;
                const localY = opts.y ?? (canvas.height / (window.devicePixelRatio || 1)) / 3;
                addParticles(localX, localY);
            },
        }));

        // Cache canvas bounding rect and process queued client-based fires inside rAF
        const canvasRectRef = React.useRef<DOMRect | null>(null);
        const pendingFiresRef = React.useRef<Array<{ clientX?: number; clientY?: number; count: number }>>([]);
        const processPendingScheduled = React.useRef<number | null>(null);

        const scheduleProcessPending = () => {
            if (processPendingScheduled.current != null) return;
            processPendingScheduled.current = requestAnimationFrame(() => {
                processPendingScheduled.current = null;
                const canvas = canvasRef.current;
                if (!canvas) return;
                canvasRectRef.current = canvas.getBoundingClientRect();
                const rect = canvasRectRef.current;
                const ratio = window.devicePixelRatio || 1;

                while (pendingFiresRef.current.length > 0) {
                    const f = pendingFiresRef.current.shift()!;
                    const cx = typeof f.clientX === 'number' && rect ? f.clientX - rect.left : (canvas.width / ratio) / 2;
                    const cy = typeof f.clientY === 'number' && rect ? f.clientY - rect.top : (canvas.height / ratio) / 3;

                    // Add particles with computed local coords
                    for (let i = 0; i < f.count; i++) {
                        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
                        const speed = 1 + Math.random() * 3;
                        const ttl = 30 + Math.random() * 40;
                        particlesRef.current.push({
                            x: cx,
                            y: cy,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 1.5,
                            life: ttl,
                            ttl,
                            size: 3 + Math.random() * 4,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        });
                    }
                }

                // start if any were added
                if (particlesRef.current.length > 0) start();
            });
        };

        useEffect(() => {
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext('2d');
            if (!ctx || !canvas) return;

            const resize = () => {
                const ratio = window.devicePixelRatio || 1;
                canvas.width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
                canvas.height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
                ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                canvasRectRef.current = null; // invalidate cached rect
            };

            resize();
            window.addEventListener('resize', resize);
            return () => window.removeEventListener('resize', resize);
        }, []);

        function start() {
            if (runningRef.current) return;
            runningRef.current = true;
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext('2d')!;

            const step = () => {
                const particles = particlesRef.current;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                for (let i = particles.length - 1; i >= 0; i--) {
                    const p = particles[i];
                    p.vy += 0.08; // lighter gravity for subtle effect
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= 1;

                    const alpha = Math.max(0, p.life / p.ttl);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.ellipse(p.x, p.y, p.size, p.size * 0.75, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;

                    // remove dead
                    if (p.life <= 0 || p.y > canvas.height + 40) {
                        particles.splice(i, 1);
                    }
                }

                if (particles.length > 0) {
                    animRef.current = requestAnimationFrame(step);
                } else {
                    runningRef.current = false;
                    if (animRef.current) cancelAnimationFrame(animRef.current);
                    animRef.current = null;
                }
            };

            animRef.current = requestAnimationFrame(step);
        }

        useEffect(() => {
            return () => {
                if (animRef.current) cancelAnimationFrame(animRef.current);
            };
        }, []);

        return (
            <div className={className} aria-hidden>
                <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
            </div>
        );
    }
);
Confetti.displayName = 'Confetti';

export default Confetti;
