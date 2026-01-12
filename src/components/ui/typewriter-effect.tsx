"use client";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type WordItem = { text: string; className?: string };

export function TypewriterEffectSmooth({ words, className = "", interval = 1800 }: { words: WordItem[]; className?: string; interval?: number }) {
    const [index, setIndex] = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (!words || words.length === 0) return;
        let mounted = true;

        const tick = () => {
            if (!mounted) return;
            setVisible(false);
            window.setTimeout(() => {
                if (!mounted) return;
                setIndex((i) => (i + 1) % words.length);
                setVisible(true);
            }, 260); // cross-fade timing
        };

        const id = window.setInterval(tick, interval);
        return () => {
            mounted = false;
            window.clearInterval(id);
        };
    }, [words, interval]);

    if (!words || words.length === 0) return null;

    const current = words[index];

    return (
        <div className={cn("inline-block overflow-hidden align-middle", className)}>
            <span
                className={cn(
                    "inline-block transition-transform duration-260 ease-in-out",
                    visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                )}
                aria-hidden={!visible}
            >
                <span className={cn(current.className || '')}>{current.text}</span>
            </span>
        </div>
    );
}

export default TypewriterEffectSmooth;