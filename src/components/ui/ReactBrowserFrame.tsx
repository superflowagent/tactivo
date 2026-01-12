import React from 'react';

export default function ReactBrowserFrame({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`relative rounded-lg border border-muted bg-card shadow-sm overflow-hidden ${className ?? ''}`}>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-muted">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="h-2 w-2 rounded-full bg-yellow-300" />
                <span className="h-2 w-2 rounded-full bg-green-400" />
            </div>
            <div className="p-3">{children}</div>
        </div>
    );
}
