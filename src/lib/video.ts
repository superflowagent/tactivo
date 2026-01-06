import { error as logError } from '@/lib/logger';

export async function compressVideoFile(
    file: File,
    maxWidth = 1920,
    mimeType = 'video/webm;codecs=vp8',
    fps = 25
) {
    // Returns a File (blob) with compressed video recorded from canvas
    return new Promise<File>(async (resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.playsInline = true;

        let settled = false;
        const safetyTimeoutMs = 120_000; // 120s compression timeout (allow larger files to be compressed)
        const safetyTimer = setTimeout(() => {
            if (!settled) {
                settled = true;
                try {
                    URL.revokeObjectURL(url);
                } catch { }
                reject(new Error('compression timed out'));
            }
        }, safetyTimeoutMs);

        // Wait for metadata to be available (poll). If it times out, fail compression.
        const metaTimeoutMs = 5000; // 5s for metadata to appear
        const start = Date.now();
        await new Promise<void>((res, rej) => {
            const check = () => {
                if (video.readyState >= 1 || video.videoWidth > 0) {
                    return res();
                }
                if (Date.now() - start > metaTimeoutMs) {
                    return rej(new Error('metadata timeout'));
                }
                setTimeout(check, 150);
            };
            check();
        });

        // At this point metadata is available; compute output sizes
        const iw = video.videoWidth;
        const ih = video.videoHeight;
        const scale = Math.min(1, maxWidth / iw);
        const ow = Math.max(1, Math.round(iw * scale));
        const oh = Math.max(1, Math.round(ih * scale));

        const canvas = document.createElement('canvas');
        canvas.width = ow;
        canvas.height = oh;
        const ctx = canvas.getContext('2d')!;

        const stream = (canvas as any).captureStream
            ? (canvas as any).captureStream(fps)
            : (canvas as any).mozCaptureStream
                ? (canvas as any).mozCaptureStream(fps)
                : null;
        if (!stream) {
            clearTimeout(safetyTimer);
            if (!settled) {
                settled = true;
                URL.revokeObjectURL(url);
                reject(new Error('Capture stream not supported in this browser'));
            }
            return;
        }

        const options: any = {};
        if (MediaRecorder.isTypeSupported(mimeType)) options.mimeType = mimeType;

        const recorder = new MediaRecorder(stream, options);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size) chunks.push(e.data);
        };
        recorder.onerror = (e) => {
            logError('compressVideoFile: recorder error', e);
        };
        recorder.onstop = () => {
            try {
                const blob = new Blob(chunks, { type: (options.mimeType || 'video/webm').split(';')[0] });
                const newName = file.name.replace(/\.[^.]+$/, '') + '.webm';
                const newFile = new File([blob], newName, { type: blob.type });
                URL.revokeObjectURL(url);
                if (!settled) {
                    settled = true;
                    clearTimeout(safetyTimer);
                    resolve(newFile);
                }
            } catch (e) {
                if (!settled) {
                    settled = true;
                    clearTimeout(safetyTimer);
                    logError('compressVideoFile: onstop error', e);
                    reject(e as any);
                }
            }
        };

        let rafHandle: number | null = null;
        const drawFrame = () => {
            try {
                ctx.drawImage(video, 0, 0, ow, oh);
            } catch (_err) {
                // sometimes drawImage fails briefly — ignore
            }
            rafHandle = requestAnimationFrame(drawFrame);
        };

        // Attach end listener and safety timeout
        video.addEventListener('ended', () => {
            if (rafHandle) cancelAnimationFrame(rafHandle);
            try {
                if (recorder.state === 'recording') recorder.stop();
            } catch (e) {
                /* ignore */
            }
        });

        // Safety timeout (in case ended doesn't fire quickly)
        const stopTimeout = Math.min(Math.max(1000, (video.duration || 0) * 1000 + 5000), 120_000);
        setTimeout(() => {
            if (!settled) {
                try {
                    if (recorder.state === 'recording') recorder.stop();
                } catch (_err) {
                    // ignore
                }
            }
        }, stopTimeout);

        // Start recording when video plays (try, then try muted)
        video.currentTime = 0;
        video
            .play()
            .then(() => {
                try {

                    recorder.start(1000);
                    drawFrame();
                } catch (e) {
                    if (!settled) {
                        settled = true;
                        clearTimeout(safetyTimer);
                        URL.revokeObjectURL(url);
                        console.error('compressVideoFile: failed to start recorder', e);
                        reject(e as any);
                    }
                }
            })
            .catch(() => {
                // If play fails (autoplay), try to play muted
                video.muted = true;
                video
                    .play()
                    .then(() => {
                        try {

                            recorder.start(1000);
                            drawFrame();
                        } catch (e) {
                            if (!settled) {
                                settled = true;
                                clearTimeout(safetyTimer);
                                URL.revokeObjectURL(url);
                                logError('compressVideoFile: failed to start recorder', e);
                                reject(e as any);
                            }
                        }
                    })
                    .catch((err2) => {
                        if (!settled) {
                            settled = true;
                            clearTimeout(safetyTimer);
                            URL.revokeObjectURL(url);
                            logError('compressVideoFile: video play failed', err2);
                            reject(err2);
                        }
                    });
            });



        video.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            if (!settled) {
                settled = true;
                clearTimeout(safetyTimer);
                logError('compressVideoFile: video error event');
                reject(new Error('Error loading video'));
            }
        });
    });
}