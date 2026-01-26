import React from 'react';
import { cn } from '@/lib/utils';

export function NeonGradientCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'rounded-xl p-px bg-gradient-to-br from-[#ff2975] from-35% to-[#00FFF1] shadow-[0_6px_30px_rgba(99,102,241,0.08)]',
                className
            )}
            aria-hidden
        >
            <div className="bg-white dark:bg-card rounded-lg p-6">
                {children}
            </div>
        </div>
    );
}
