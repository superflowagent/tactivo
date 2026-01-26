import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import FeaturePreviewAgenda from './FeaturePreviewAgenda';
import FeaturePreviewMultidispositivo from './FeaturePreviewMultidispositivo';
import FeaturePreviewClases from './FeaturePreviewClases';
import FeaturePreviewProgramas from './FeaturePreviewProgramas';
import Reveal from '@/components/ui/Reveal';

export function FeaturesSection() {
  const features = [
    {
      title: 'Agenda autónoma',
      description:
        'Deja que tus pacientes reserven sus citas bajo tus condiciones para ahorrarte tiempo en buscar huecos.',
    },
    {
      title: 'Clases',
      description: 'Organiza clases y entrenamientos grupales sin esfuerzo.',
    },
    {
      title: 'Programas de ejercicios',
      description:
        'Crea de forma sencilla programas de ejercicios para tus pacientes usando tu librería de ejercicios.',
    },
    {
      title: 'Multidispositivo',
      description: 'Gestiona tu centro desde cualquier lugar.',
    },
  ];



  return (
    <section aria-labelledby="funcionalidades" className="w-full py-16">
      <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
        <h2 id="funcionalidades" className="text-3xl font-extrabold mb-6 text-center">Funcionalidades</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f, idx) => {
            const cardHeightClass = 'min-h-[28rem]';
            const delay = idx * 90; // stagger: 90ms
            return (
              <Reveal key={f.title} delay={delay}>
                <Card tabIndex={0} className={`w-full group cursor-default relative overflow-hidden flex flex-col ${cardHeightClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transform-gpu transition-transform duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none`}>
                  <div className="relative z-10 flex-1 flex flex-col sm:flex-row items-center w-full h-full">
                    <div className="w-full sm:w-[34%] p-6 flex flex-col justify-center">
                      <CardHeader className="p-0">
                        <CardTitle className="text-lg">{f.title}</CardTitle>
                        <CardDescription>{f.description}</CardDescription>
                      </CardHeader>
                    </div>

                    <div className="w-full sm:w-[66%] p-6 flex-1 flex items-center justify-center">
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
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
