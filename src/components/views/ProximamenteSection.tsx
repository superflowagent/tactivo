import React from 'react';
import { FileText, CreditCard, Pencil, Bell, Video, TrendingUp } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';

export default function ProximamenteSection() {
    const items = [
        { title: 'Verifactu', icon: FileText, description: 'Integración de facturación y generación de facturas de acuerdo a normativa.' },
        { title: 'Cobros integrados', icon: CreditCard, description: 'Pasarelas de pago y cobros automáticos para tus clientes.' },
        { title: 'Recordatorios automáticos', icon: Bell, description: 'Recordatorios y notificaciones para citas y seguimientos.' },
        { title: 'Firma de documentos', icon: Pencil, description: 'Firma electrónica y archivado de documentación.' },
        { title: 'Videoconsultas', icon: Video, description: 'Videollamadas integradas para consultas online.' },
        { title: 'Panel de desarrollo de negocio', icon: TrendingUp, description: 'Métricas y herramientas para hacer crecer tu clínica.' },
    ];

    return (
        <section aria-labelledby="proximamente" className="w-full py-12">
            <div className="mx-auto max-w-7xl md:max-w-[85rem] px-6">
                <Reveal className="reveal-from-bottom">
                    <h2 id="proximamente" className="text-3xl font-extrabold mb-6 text-center">Próximamente</h2>
                </Reveal>

                <Reveal className="reveal-from-bottom">
                    <div className="rounded-md pt-0 pb-6 px-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {items.map((it) => {
                                const Icon = it.icon;
                                return (
                                    <Reveal key={it.title}>
                                        <div tabIndex={0} className="flex items-start gap-4 rounded-md border-2 border-muted p-4 bg-primary/5 transition-transform duration-150 ease-in-out transform hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                                            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-md" style={{ background: 'var(--primary-gradient)' }}>
                                                <Icon className="w-6 h-6 text-white" aria-hidden />
                                            </div>

                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold">{it.title}</div>
                                                <div className="mt-1 text-xs text-muted-foreground">{it.description}</div>
                                            </div>
                                        </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
