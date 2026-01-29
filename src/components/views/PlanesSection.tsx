import React from 'react';

import { NeonGradientCard } from '@/registry/magicui/neon-gradient-card';

export default function PlanesSection() {


    return (
        <section aria-labelledby="planes" className="w-full py-12">
            <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
                <h2 id="planes" className="text-3xl font-extrabold mb-6 text-center">Planes</h2>

                <div className="rounded-md pt-0 pb-6 px-6">
                    <div className="flex justify-center">
                        <NeonGradientCard className="max-w-md w-full">
                            <div className="text-left">
                                <div className="relative mb-2">


                                    <div className="flex items-start">
                                        <div>
                                            <h3 className="text-xl font-semibold">Plan Fundador</h3>
                                            <div className="text-sm text-muted-foreground">0€/mes</div>
                                        </div>
                                    </div>
                                </div>

                                <p className="mt-4 text-sm text-muted-foreground">Todo lo esencial para poner en marcha tu clínica.</p>

                                <ul className="mt-4 space-y-3 text-sm text-neutral-700">
                                    <li className="flex items-start gap-3">
                                        <svg className="w-4 h-4 text-primary mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Calendario de la clínica</span>
                                    </li>

                                    <li className="flex items-start gap-3">
                                        <svg className="w-4 h-4 text-primary mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Base de datos de fichas de clientes</span>
                                    </li>

                                    <li className="flex items-start gap-3">
                                        <svg className="w-4 h-4 text-primary mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Soporte multi-profesional</span>
                                    </li>


                                    <li className="flex items-start gap-3">
                                        <svg className="w-4 h-4 text-primary mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Gestión de clases en grupo</span>
                                    </li>

                                    <li className="flex items-start gap-3">
                                        <svg className="w-4 h-4 text-primary mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Librería de ejercicios global</span>
                                    </li>

                                    <li className="flex items-start gap-3">
                                        <svg className="w-4 h-4 text-primary mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Programas de ejercicios</span>
                                    </li>

                                    <li className="flex items-start gap-3">
                                        <svg className="w-4 h-4 text-primary mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Cumplimiento RGPD</span>
                                    </li>
                                </ul>

                                <div className="mt-6">
                                    <a href="/login" className="inline-flex items-center justify-center w-full px-4 py-2 rounded-md text-white font-semibold" style={{ background: 'var(--primary-gradient)' }}>
                                        Crear cuenta
                                    </a>
                                    <div className="mt-2 text-xs text-muted-foreground">Sin tarjeta de crédito</div>
                                </div>
                            </div>
                        </NeonGradientCard>
                    </div>
                </div>
            </div>
        </section>
    );
}
