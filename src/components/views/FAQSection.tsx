import React from 'react';
import { ChevronDown } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';

export function FAQSection() {


    const faqs = [
        {
            q: '¿Qué es el "Plan Fundador" y por qué es gratis?',
            a: 'Es nuestro acceso especial de lanzamiento. Queremos que los primeros fisios nos ayuden a mejorar la herramienta y, a cambio, disfrutas del CRM 100% gratis mientras terminamos de pulir las últimas funciones.'
        },
        {
            q: '¿Perderé mis datos en el futuro?',
            a: 'Nunca. Tus datos son tuyos. Si en el futuro el plan cambia, te avisaremos con antelación y siempre podrás exportar toda tu información o mantener condiciones especiales por ser pionero.'
        },
        {
            q: '¿Qué horario tiene el soporte técnico?',
            a: 'Estamos disponibles de lunes a sábado, de 08:00 a 22:00, a través de email y teléfono. Resolvemos tus dudas casi en tiempo real para que tu clínica nunca se pare.'
        },
        {
            q: '¿Es seguro para los datos de mis clientes?',
            a: 'Totalmente. Cumplimos estrictamente con el RGPD. Los datos de salud están cifrados en servidores seguros, garantizando la máxima privacidad y protección legal para tu clínica.'
        },
        {
            q: '¿Cómo funciona la librería de ejercicios?',
            a: 'Puedes crear tu propia base de datos con vídeos, descripciones y etiquetas. Estos ejercicios quedan almacenados para que tu equipo y tú los podáis usar para confeccionar los programas de vuestros clientes.'
        },
        {
            q: '¿Qué pueden hacer los clientes desde su propio acceso?',
            a: 'Cada cliente tiene su login personal donde puede apuntarse a clases, consultar sus citas pendientes, autoagendar citas según la disponibilidad del centro y ver los programas de ejercicios que le habéis preparado.'
        },
        {
            q: '¿Cómo ven los clientes sus programas de ejercicios?',
            a: 'Desde su panel (ordenador o móvil), tienen acceso a los programas que les habéis confeccionado. Además del video, podéis especificarles series, repeticiones y peso, lo que mejora la adherencia al tratamiento desde casa.'
        },
        {
            q: '¿Puedo gestionar a varios fisioterapeutas?',
            a: 'Sí. El sistema permite configurar varios perfiles profesionales. Cada uno tendrá su propia agenda, disponibilidad y especialidades, centralizando toda la actividad del centro en un solo lugar.'
        }
    ];

    const contentRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const [openMap, setOpenMap] = React.useState<Record<number, boolean>>({});

    const toggle = (i: number) => {
        const el = contentRefs.current[i];
        const isOpen = !!openMap[i];

        if (!el) {
            setOpenMap((prev) => ({ ...prev, [i]: !isOpen }));
            return;
        }

        if (!isOpen) {
            // open: from 0 -> scrollHeight -> auto
            el.style.display = 'block';
            el.style.height = '0px';
            // force reflow
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            el.offsetHeight;
            el.style.transition = 'height 220ms ease';
            el.style.height = `${el.scrollHeight}px`;

            const onEnd = () => {
                el.style.height = 'auto';
                el.removeEventListener('transitionend', onEnd);
            };
            el.addEventListener('transitionend', onEnd);

            setOpenMap((prev) => ({ ...prev, [i]: true }));
        } else {
            // close: from auto (or px) -> 0
            const currentHeight = el.getBoundingClientRect().height;
            el.style.height = `${currentHeight}px`;
            // force reflow
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            el.offsetHeight;
            el.style.transition = 'height 220ms ease';
            el.style.height = '0px';

            const onEnd = () => {
                el.style.display = '';
                el.removeEventListener('transitionend', onEnd);
            };
            el.addEventListener('transitionend', onEnd);

            setOpenMap((prev) => ({ ...prev, [i]: false }));
        }
    };

    return (
        <section aria-labelledby="preguntas-frecuentes" className="w-full py-12">
            <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
                <h2 id="preguntas-frecuentes" className="text-3xl font-extrabold mb-6 text-center">Preguntas frecuentes</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    {faqs.map((f, idx) => {
                        const isOpen = !!openMap[idx];
                        const delay = idx * 60; // stagger: 60ms
                        return (
                            <Reveal key={f.q} delay={delay}>
                                <div className="border-2 border-muted rounded-md bg-muted/5 overflow-hidden">
                                    <button
                                        type="button"
                                        className="w-full p-4 flex items-center justify-between text-left focus:outline-none"
                                        onClick={() => toggle(idx)}
                                        aria-expanded={isOpen}
                                        aria-controls={`faq-${idx}-content`}
                                    >
                                        <span className="font-medium">{f.q}</span>
                                        <ChevronDown size={18} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'} text-neutral-600`} aria-hidden />
                                    </button>

                                    <div
                                        id={`faq-${idx}-content`}
                                        ref={(el) => (contentRefs.current[idx] = el)}
                                        className="px-4"
                                        style={{ height: '0px', overflow: 'hidden', transition: 'height 220ms ease' }}
                                    >
                                        <div className="pt-2 pb-4 text-sm text-neutral-700">{f.a}</div>
                                    </div>
                                </div>
                            </Reveal>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default FAQSection;
