export function loadGtag(trackingId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return resolve();

        // If gtag script already present, resolve when gtag is ready
        const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${trackingId}"]`);
        if (existingScript) {
            // Ensure dataLayer and gtag exist
            window.dataLayer = window.dataLayer || [];
            (window as any).gtag = (window as any).gtag || function gtag() { (window as any).dataLayer.push(arguments); };
            return resolve();
        }

        // Insert the async script tag
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
        script.onload = () => {
            try {
                window.dataLayer = window.dataLayer || [];
                (window as any).gtag = (window as any).gtag || function gtag() { (window as any).dataLayer.push(arguments); };
                // Do not call config here; leave it to the caller to decide when to configure
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);

        // Add the inline helper (same code GA suggests) but without calling gtag('config')
        const inline = document.createElement('script');
        inline.text = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}`;
        document.head.appendChild(inline);
    });
}

declare global {
    interface Window { dataLayer?: any[]; gtag?: (...args: any[]) => void }
}
