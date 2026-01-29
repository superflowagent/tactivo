import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';

export function LandingFooter() {
    return (
        <footer className="bg-background border-t border-muted mt-12">
            <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col md:flex-row items-start justify-between gap-2">
                <div className="flex flex-col md:flex-row items-center gap-6 w-full justify-center md:justify-start">
                    <nav className="flex gap-4 flex-wrap text-sm justify-center">
                        <span className="text-neutral-600 cursor-default">Aviso Legal</span>
                        <span className="text-neutral-600 cursor-default">Política de Privacidad</span>
                        <span className="text-neutral-600 cursor-default">Política de Cookies</span>
                        <span className="text-neutral-600 cursor-default">Términos y Condiciones</span>
                    </nav>
                </div>

                <div className="flex flex-col items-center md:items-end text-sm text-neutral-600 gap-2 w-full md:w-auto text-center md:text-right mt-4 md:mt-0">
                    <div className="flex items-center gap-3 justify-center md:justify-end">
                        <Mail size={16} className="text-neutral-600" aria-hidden />
                        <a href="mailto:info@tactivo.es" className="hover:text-primary transition">info@tactivo.es</a>
                    </div>
                    <div className="flex items-center gap-3 justify-center md:justify-end">
                        <Phone size={16} className="text-neutral-600" aria-hidden />
                        <a href="tel:+34742072760" className="hover:text-primary transition">742072760</a>
                    </div>
                    <div className="flex items-center gap-3 justify-center md:justify-end">
                        <MapPin size={16} className="text-neutral-600" aria-hidden />
                        <span className="whitespace-nowrap">Valencia, España</span>
                    </div>
                </div>
            </div>

            <div className="border-t border-muted/70 mt-0">
                <div className="max-w-7xl mx-auto px-6 py-1 text-center text-xs text-neutral-500">
                    © 2026 Tactivo. Todos los derechos reservados.
                </div>
            </div>
        </footer>
    );
}
