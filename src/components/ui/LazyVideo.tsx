import React from 'react';

type Props = {
    src: string;
    poster?: string;
    className?: string;
    muted?: boolean;
    loop?: boolean;
    playsInline?: boolean;
    autoPlay?: boolean;
    onError?: (e: Event) => void;
};

export default function LazyVideo({
    src,
    poster,
    className,
    muted = true,
    loop = true,
    playsInline = true,
    autoPlay = true,
    onError,
}: Props) {
    const ref = React.useRef<HTMLVideoElement | null>(null);
    const [inView, setInView] = React.useState(false);
    const [sourcesAdded, setSourcesAdded] = React.useState(false);

    React.useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;

        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0) setInView(true);
                    else setInView(false);
                });
            },
            { threshold: 0.25 }
        );

        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (inView) {
            if (!sourcesAdded) {
                // Prefer webm then fallback to mp4
                try {
                    const webm = src.replace(/\.mp4$/i, '.webm');
                    const s1 = document.createElement('source');
                    s1.setAttribute('src', webm);
                    s1.setAttribute('type', 'video/webm');
                    el.appendChild(s1);
                } catch { }

                const s2 = document.createElement('source');
                s2.setAttribute('src', src);
                s2.setAttribute('type', 'video/mp4');
                el.appendChild(s2);

                el.setAttribute('preload', 'auto');
                setSourcesAdded(true);
                // Try to load and play when ready
                try {
                    el.load();
                    if (autoPlay) el.play().catch(() => { });
                } catch { }
            } else {
                if (autoPlay) el.play().catch(() => { });
            }
        } else {
            try {
                el.pause();
            } catch { }
        }
    }, [inView, src, sourcesAdded, autoPlay]);

    React.useEffect(() => {
        const el = ref.current;
        if (!el || !onError) return;
        const handler = (ev: Event) => onError(ev);
        el.addEventListener('error', handler as EventListener);
        return () => el.removeEventListener('error', handler as EventListener);
    }, [onError]);

    return (
        <video
            ref={ref}
            poster={poster}
            muted={muted}
            loop={loop}
            playsInline={playsInline}
            className={className}
            aria-hidden
        />
    );
}
