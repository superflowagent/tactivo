import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function FeaturesSection() {
  const features = [
    {
      title: 'Agenda autónoma',
      description:
        'Deja que tus pacientes reserven sus citas bajo tus condiciones para ahorrarte tiempo en buscar huecos.',
    },
    {
      title: 'Historias clínicas',
      description: 'Toda la información de tu paciente al alcance de un click.',
    },
    {
      title: 'Dashboard',
      description: 'Reportes automáticos del progreso e ingresos de tu centro.',
    },
    {
      title: 'Multidispositivo',
      description: 'Consulta tu agenda desde cualquier lugar.',
    },
    {
      title: 'Librería de ejercicios',
      description:
        'Archiva de forma eficiente video-ejercicios, clasificándolos por area y equipamiento.',
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
    {
      title: 'Bonos',
      description: 'Autogestión de bonos de clases y citas.',
    },
  ];

  return (
    <section aria-labelledby="funcionalidades" className="w-full py-16">
      <div className="mx-auto max-w-7xl px-6">
        <h2 id="funcionalidades" className="text-3xl font-extrabold mb-6">
          Funcionalidades
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-stretch w-full sm:min-h-[20rem]">
                <div className="w-full sm:w-[40%] p-6 flex flex-col justify-center">
                  <CardHeader className="p-0">
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                </div>

                <div className="w-full sm:w-[60%] p-6 flex-none flex items-center">
                  {/* Placeholder for Preview - to implement later */}
                  <div className="rounded-md border border-dashed border-muted p-4 h-64 sm:h-full flex items-center justify-center bg-muted/10 w-full">
                    <span className="text-muted-foreground">Preview (placeholder)</span>
                  </div>
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
