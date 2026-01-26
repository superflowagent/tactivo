import React from 'react';

type Props = {
    children: React.ReactNode;
    className?: string;
    rootMargin?: string;
    threshold?: number | number[];
    once?: boolean;
    style?: React.CSSProperties;
    delay?: number; // ms
};

export default function Reveal({
    children,
    className = '',
    rootMargin = '0px 0px -8% 0px',
    threshold = 0.12,
    once = true,
    style,
    delay,
}: Props) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let observer: IntersectionObserver | null = null;

        observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    setVisible(true);
                    if (once && observer) {
                        observer.disconnect();
                        observer = null;
                    }
                }
            },
            { rootMargin, threshold }
        );

        observer.observe(el);

        return () => {
            if (observer) observer.disconnect();
        };
    }, [once, rootMargin, threshold]);

    const mergedStyle = { ...(style || {}), ...(delay ? { transitionDelay: `${delay}ms` } : {}) } as React.CSSProperties;

    return (
        <div
            ref={ref}
            className={`${className} reveal ${visible ? 'reveal-visible' : ''}`.trim()}
            style={mergedStyle}
        >
            {children}
        </div>
    );
}

