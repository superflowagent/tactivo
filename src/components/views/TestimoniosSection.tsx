import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import AnimatedTestimonials from '@/components/ui/animated-testimonials';

export default function TestimoniosSection() {
    const testimonialsRef = React.useRef<any>(null);
    const [internalIndex, setInternalIndex] = React.useState(0);
    const [internalProgress, setInternalProgress] = React.useState(0);

    const testimonialsList = [
        {
            quote: "La agenda autónoma ha reducido nuestras llamadas en un 40%. Los pacientes adoran poder reservar su cita en cualquier momento sin esperar.",
            name: "Dra. Elena Martínez",
            designation: "Directora de Clínica (Madrid)",
            src: `${import.meta.env.BASE_URL}landing/professional1.jpg?v=2`,
        },
        {
            quote: "Gracias a la librería de ejercicios y los programas personalizados, mis pacientes tienen mucha más adherencia al tratamiento. ¡Espectacular!",
            name: "Marc Ribas",
            designation: "Fisioterapia Deportiva (Barcelona)",
            src: `${import.meta.env.BASE_URL}landing/professional2.jpg?v=2`,
        },
        {
            quote: "Gestionar las clases grupales ahora es automático. Mis alumnos se apuntan de forma autónoma y yo me olvido de la gestión manual por WhatsApp.",
            name: "Lucía Fernández",
            designation: "Especialista Suelo Pélvico (Sevilla)",
            src: `${import.meta.env.BASE_URL}landing/professional3.jpg?v=2`,
        },
        {
            quote: "Tener la ficha del paciente y el historial de ejercicios integrados me ahorra horas de oficina a la semana. Sencillo y muy profesional.",
            name: "Javier Sotelo",
            designation: "Fisioterapeuta (A Coruña)",
            src: `${import.meta.env.BASE_URL}landing/professional4.jpg?v=2`,
        },
        {
            quote: "La gestión multiprofesional es clave. Coordinar las vacaciones y la disponibilidad de todo el equipo por fin es una tarea fácil.",
            name: "Juan Beltrán",
            designation: "Coordinador de Centro (Valencia)",
            src: `${import.meta.env.BASE_URL}landing/professional5.jpg?v=2`,
        },
    ];

    return (
        <section aria-labelledby="testimonios" className="w-full py-16">
            <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
                <h2 id="testimonios" className="text-3xl font-extrabold mb-6 text-center">Testimonios</h2>

                <div className="rounded-md p-0 border-2 border-muted mx-auto max-w-4xl">
                    <AnimatedTestimonials
                        hideControls
                        ref={testimonialsRef}
                        onIndexChange={setInternalIndex}
                        onProgress={setInternalProgress}
                        testimonials={testimonialsList}
                    />
                </div>

                <div className="w-full flex justify-center mt-4 mb-2">
                    <div className="w-full max-w-4xl">
                        <div className="h-1 bg-transparent rounded-full overflow-hidden">
                            <div className="h-full origin-left" style={{ transform: `scaleX(${internalProgress})`, willChange: 'transform', background: 'var(--primary-gradient)' }} aria-hidden />
                        </div>
                    </div>
                </div>

                <div className="mt-4 p-4 flex items-center justify-center gap-4 mx-auto max-w-4xl">
                    <button
                        onClick={() => testimonialsRef.current?.prev()}
                        aria-label="Anterior testimonio"
                        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/10 hover:bg-muted/20 text-foreground"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>

                    <button
                        onClick={() => testimonialsRef.current?.next()}
                        aria-label="Siguiente testimonio"
                        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/10 hover:bg-muted/20 text-foreground"
                    >
                        <ArrowRight className="w-6 h-6" />
                    </button>

                    <div className="ml-4 flex items-center gap-3">
                        {testimonialsList.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => testimonialsRef.current?.setIndex(i)}
                                aria-label={`Ir al testimonio ${i + 1}`}
                                className={`w-3 h-3 rounded-full transform transition ${i === internalIndex ? 'bg-foreground scale-110' : 'bg-slate-300 scale-100'}`}
                            />
                        ))}
                    </div>


                </div>
            </div>
        </section>
    );
}
