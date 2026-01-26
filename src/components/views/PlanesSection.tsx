import React from 'react';
import Typewriter from '@/components/ui/typewriter';

export default function PlanesSection() {
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const [playAnimatedTitle, setPlayAnimatedTitle] = React.useState(false);
  const triggeredRef = React.useRef(false);

  React.useEffect(() => {
    const el = headingRef.current;
    if (!el) return;

    let timerId: number | undefined;
    let observer: IntersectionObserver | null = null;

    const onScroll = (ev?: Event) => {
      if (ev && (ev as Event).isTrusted === false) return;

      const rect = headingRef.current?.getBoundingClientRect();
      if (!rect) return;
      const isVisible = rect.top >= 0 && rect.top < (window.innerHeight || document.documentElement.clientHeight);
      if (isVisible && !triggeredRef.current) {
        triggeredRef.current = true;
        if (timerId) {
          window.clearTimeout(timerId);
          timerId = undefined;
        }
        setPlayAnimatedTitle(true);
        window.removeEventListener('scroll', onScroll);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && window.scrollY === 0 && !triggeredRef.current) {
          triggeredRef.current = true;
          timerId = window.setTimeout(() => {
            setPlayAnimatedTitle(true);
            window.removeEventListener('scroll', onScroll);
            if (observer) {
              observer.disconnect();
              observer = null;
            }
          }, 5000);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (timerId) window.clearTimeout(timerId);
    };
  }, []);

  return (
    <section aria-labelledby="planes" className="w-full py-16">
      <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
        <h2 id="planes" ref={headingRef} className="text-3xl font-extrabold mb-6 text-center">
          {playAnimatedTitle ? (
            <Typewriter phrases={["Planes"]} loop={false} typingSpeed={60} className="inline-block" />
          ) : (
            <span className="inline-block">Planes</span>
          )}
        </h2>

        <div className="rounded-md p-6">
          {/* Placeholder content for Planes */}
          <div className="w-full rounded-lg border border-dashed border-muted/40 p-8 text-center text-neutral-700">
            <div className="text-lg font-semibold mb-2">Planes (placeholder)</div>
            <div className="text-sm">Aquí irá el contenido de la sección Planes. Puedes añadir tarjetas, comparativas o un CTA.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
