export async function compressVideoFile(file: File, maxWidth = 1920, mimeType = 'video/webm;codecs=vp8', fps = 25) {
    // Returns a File (blob) with compressed video recorded from canvas
    return new Promise<File>(async (resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.playsInline = true;

        try {
            await video.play().catch(() => { });
        } catch {
            // ignore, we'll wait for loadedmetadata
        }

        video.addEventListener('loadedmetadata', () => {
            const iw = video.videoWidth;
            const ih = video.videoHeight;
            const scale = Math.min(1, maxWidth / iw);
            const ow = Math.max(1, Math.round(iw * scale));
            const oh = Math.max(1, Math.round(ih * scale));

            const canvas = document.createElement('canvas');
            canvas.width = ow;
            canvas.height = oh;
            const ctx = canvas.getContext('2d')!;

            const stream = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(fps) : null;
            if (!stream) {
                reject(new Error('Capture stream not supported in this browser'));
                return;
            }

            const options: any = {};
            if (MediaRecorder.isTypeSupported(mimeType)) options.mimeType = mimeType;

            const recorder = new MediaRecorder(stream, options);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
            recorder.onerror = (e) => { console.error('recorder error', e); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
                const newName = file.name.replace(/\.[^.]+$/, '') + '.webm';
                const newFile = new File([blob], newName, { type: blob.type });
                URL.revokeObjectURL(url);
                resolve(newFile);
            };

            let rafHandle: number | null = null;
            const drawFrame = () => {
                try {
                    ctx.drawImage(video, 0, 0, ow, oh);
                } catch {
                    // sometimes drawImage fails briefly
                }
                rafHandle = requestAnimationFrame(drawFrame);
            };

            // Start recording when video plays
            video.currentTime = 0;
            video.play().then(() => {
                recorder.start(1000);
                drawFrame();
            }).catch(() => {
                // If play fails (autoplay), try to play muted
                video.muted = true;
                video.play().then(() => {
                    recorder.start(1000);
                    drawFrame();
                }).catch((err2) => {
                    reject(err2);
                });
            });

            // Stop when video ends
            video.addEventListener('ended', () => {
                if (rafHandle) cancelAnimationFrame(rafHandle);
                try { recorder.stop(); } catch { /* ignore */ }
            });

            // Safety timeout (in case ended doesn't fire)
            setTimeout(() => {
                if (recorder.state === 'recording') {
                    try { recorder.stop(); } catch { }
                }
            }, Math.max(1000, (video.duration || 0) * 1000 + 5000));
        });

        video.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            reject(new Error('Error loading video'));
        });
    });
}