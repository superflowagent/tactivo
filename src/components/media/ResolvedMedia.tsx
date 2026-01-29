import React from 'react';
import useResolvedFileUrl from '@/hooks/useResolvedFileUrl';

type Props = {
    bucket: string;
    id?: string | null;
    filename?: string | null;
    className?: string;
    controls?: boolean;
    onMouseDown?: (e: React.MouseEvent) => void;
    onPointerDown?: (e: React.PointerEvent) => void;
};

const isVideoFile = (file?: string | null) => {
    if (!file) return false;
    const f = file.toLowerCase();
    return f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm');
};

export default function ResolvedMedia({ bucket, id, filename, className, controls, onMouseDown, onPointerDown }: Props) {
    const url = useResolvedFileUrl(bucket, id, filename);

    if (!filename) return null;

    // If we don't yet have a resolved URL (signed or public), render a neutral placeholder
    if (!url) {
        return (
            <div className={className || 'w-full h-full flex items-center justify-center bg-slate-100'}>
                <p className="text-sm text-slate-400">Sin archivo</p>
            </div>
        );
    }

    if (isVideoFile(filename)) {
        return (
            <video
                src={url}
                className={className}
                controls={controls}
                onMouseDown={onMouseDown}
                onPointerDown={onPointerDown}
            />
        );
    }

    return (
        <img
            src={url}
            className={className}
            onMouseDown={onMouseDown}
            onPointerDown={onPointerDown}
        />
    );
}
