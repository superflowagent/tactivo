import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Typewriter from '@/components/ui/typewriter';
import FeaturePreviewAgenda from './FeaturePreviewAgenda';
import FeaturePreviewMultidispositivo from './FeaturePreviewMultidispositivo';
import FeaturePreviewClases from './FeaturePreviewClases';
import FeaturePreviewProgramas from './FeaturePreviewProgramas';

export function FeaturesSection() {
  const features = [
    {
      title: 'Agenda autónoma',
      description:
        'Deja que tus pacientes reserven sus citas bajo tus condiciones para ahorrarte tiempo en buscar huecos.',
    },
    {
      title: 'Multidispositivo',
      description: 'Gestiona tu centro desde cualquier lugar.',
    },
    {
      title: 'Programas de ejercicios',
      description:
        'Crea de forma sencilla programas de ejercicios para tus pacientes usando tu librería de ejercicios.',
    },
    {
      title: 'Clases',
      description: 'Organiza clases y entrenamientos grupales sin esfuerzo.',
    },
  ];

  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const [playAnimatedTitle, setPlayAnimatedTitle] = React.useState(false);
  const triggeredRef = React.useRef(false);

  React.useEffect(() => {
    const el = headingRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Only trigger when element is intersecting and coming from below (user scrolled down)
        if (entry.isIntersecting && entry.boundingClientRect.top > 0 && !triggeredRef.current) {
          triggeredRef.current = true;
          // small delay to avoid simultaneous start with hero highlight
          const delay = 500;
          window.setTimeout(() => setPlayAnimatedTitle(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-labelledby="funcionalidades" className="w-full py-16">
      <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
        <h2 id="funcionalidades" ref={headingRef} className="text-3xl font-extrabold mb-6 text-center">
          {playAnimatedTitle ? (
            <Typewriter phrases={["Funcionalidades"]} loop={false} typingSpeed={60} className="inline-block" />
          ) : (
            <span className="inline-block">Funcionalidades</span>
          )}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f) => (
            <Card key={f.title} tabIndex={0} className="w-full group cursor-default relative overflow-hidden h-128 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transform-gpu transition-transform duration-200 ease-out hover:scale-[1.01] hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-stretch w-full sm:min-h-[20rem]">
                <div className="w-full sm:w-[34%] p-6 flex flex-col justify-center">
                  <CardHeader className="p-0">
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                </div>

                <div className="w-full sm:w-[66%] p-6 flex-none flex items-center">
                  {f.title === 'Agenda autónoma' ? (
                    <FeaturePreviewAgenda />
                  ) : f.title === 'Multidispositivo' ? (
                    <FeaturePreviewMultidispositivo />
                  ) : f.title === 'Clases' ? (
                    <FeaturePreviewClases />
                  ) : f.title === 'Programas de ejercicios' ? (
                    <FeaturePreviewProgramas />
                  ) : (
                    <div className="rounded-md border border-dashed border-muted p-4 h-64 sm:h-full flex items-center justify-center bg-muted/10 w-full">
                      <span className="text-muted-foreground">Preview (placeholder)</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
