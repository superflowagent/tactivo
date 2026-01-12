import React from 'react';
import { cn } from '@/lib/utils';
import { Calendar, FileText, BarChart, Smartphone, Dumbbell, Users, Ticket } from 'lucide-react';

import { StickyScroll } from '@/components/ui/sticky-scroll-reveal';

export default function FeaturesSection() {
    const features = [
        {
            title: 'Agenda autónoma',
            description:
                'Deja que tus pacientes reserven sus citas bajo tus condiciones para ahorrarte tiempo en buscar huecos.',
            icon: (
                <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundImage: 'var(--primary-gradient)' }}>
                    <Calendar className="w-5 h-5 text-white" />
                </div>
            ),
            content: (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md text-neutral-600">Preview (Agenda autónoma)</div>
                </div>
            ),
        },
        {
            title: 'Historias clínicas',
            description: 'Toda la información de tu paciente al alcance de un click.',
            icon: (
                <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundImage: 'var(--primary-gradient)' }}>
                    <FileText className="w-5 h-5 text-white" />
                </div>
            ),
            content: (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md text-neutral-600">Preview (Historias clínicas)</div>
                </div>
            ),
        },
        {
            title: 'Dashboard',
            description: 'Reportes automáticos del progreso e ingresos de tu centro.',
            icon: (
                <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundImage: 'var(--primary-gradient)' }}>
                    <BarChart className="w-5 h-5 text-white" />
                </div>
            ),
            content: (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md text-neutral-600">Preview (Dashboard)</div>
                </div>
            ),
        },
        {
            title: 'Multidispositivo',
            description: 'Consulta tu agenda desde cualquier lugar.',
            icon: (
                <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundImage: 'var(--primary-gradient)' }}>
                    <Smartphone className="w-5 h-5 text-white" />
                </div>
            ),
            content: (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md text-neutral-600">Preview (Multidispositivo)</div>
                </div>
            ),
        },
        {
            title: 'Programas de ejercicios',
            description: 'Crea de forma sencilla programas de ejercicios para tus pacientes.',
            icon: (
                <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundImage: 'var(--primary-gradient)' }}>
                    <Dumbbell className="w-5 h-5 text-white" />
                </div>
            ),
            content: (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md text-neutral-600">Preview (Programas de ejercicios)</div>
                </div>
            ),
        },
        {
            title: 'Clases',
            description: 'Organiza clases y entrenamientos grupales sin esfuerzo.',
            icon: (
                <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundImage: 'var(--primary-gradient)' }}>
                    <Users className="w-5 h-5 text-white" />
                </div>
            ),
            content: (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md text-neutral-600">Preview (Clases)</div>
                </div>
            ),
        },
        {
            title: 'Bonos',
            description: 'Autogestión de bonos de clases y citas.',
            icon: (
                <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundImage: 'var(--primary-gradient)' }}>
                    <Ticket className="w-5 h-5 text-white" />
                </div>
            ),
            content: (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md text-neutral-600">Preview (Bonos)</div>
                </div>
            ),
        },
    ];

    return (
        <div className="w-full">
            <StickyScroll content={features} contentClassName="lg:w-96 lg:h-72" />
        </div>
    );
}

const Feature = ({
    title,
    description,
    icon,
    index,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    index: number;
}) => {
    return (
        <div
            className={cn(
                'flex flex-col lg:border-r  py-10 relative group/feature dark:border-neutral-800',
                (index === 0 || index === 4) && 'lg:border-l dark:border-neutral-800',
                index < 4 && 'lg:border-b dark:border-neutral-800',
            )}
        >
            {index < 4 && (
                <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            )}
            {index >= 4 && (
                <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            )}
            <div className="mb-4 relative z-10 px-10 text-neutral-900 dark:text-neutral-400">{icon}</div>
            <div className="text-lg font-bold mb-2 relative z-10 px-10">
                <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 transition-all duration-200 origin-center overflow-hidden">
                    <div className="absolute inset-0 transition-opacity duration-200 opacity-0 group-hover/feature:opacity-100" style={{ backgroundImage: 'linear-gradient(180deg, #6366F1 0%, #A78BFA 100%)' }} aria-hidden />
                </div>
                <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-900 dark:text-neutral-100">{title}</span>
            </div>
            <p className="text-sm text-neutral-900 dark:text-neutral-300 max-w-xs relative z-10 px-10">{description}</p>
        </div>
    );
};