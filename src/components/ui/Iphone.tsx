import React from 'react';

export function Iphone({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
    return (
        <div className="flex items-center justify-center">
            <div
                className={`relative rounded-3xl border border-neutral-700 bg-black shadow-md overflow-hidden box-border max-w-full max-h-full ${className || 'w-[320px] h-[640px]'} `}
                style={{ willChange: 'transform', contain: 'paint', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
            >
                {/* screen (reduced frame thickness) */}
                <div className="absolute inset-2 rounded-2xl bg-surface overflow-hidden" style={{ contain: 'paint' }}>
                    <div className="w-full h-full bg-white text-sm text-foreground">{children}</div>
                </div>

                {/* home indicator (smaller) */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 rounded-full bg-black/30" />
            </div>
        </div>
    );
}

export default Iphone;
