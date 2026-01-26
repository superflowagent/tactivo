import React from 'react';
import Typewriter from '@/components/ui/typewriter';
import AnimatedTestimonials from '@/components/ui/animated-testimonials';

export default function TestimoniosSection() {
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
        <section aria-labelledby="testimonios" className="w-full py-16">
            <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
                <h2 id="testimonios" ref={headingRef} className="text-3xl font-extrabold mb-6 text-center">
                    {playAnimatedTitle ? (
                        <Typewriter phrases={["Testimonios"]} loop={false} typingSpeed={60} className="inline-block" />
                    ) : (
                        <span className="inline-block">Testimonios</span>
                    )}
                </h2>

                <div className="rounded-md p-0">
                    <AnimatedTestimonials
                        testimonials={[
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
                        ]}
                    />
                </div>
            </div>
        </section>
    );
}
