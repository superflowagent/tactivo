import React, { useState } from 'react';

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { title: 'Funcionalidades', href: '#funcionalidades' },
    { title: 'Testimonios', href: '#testimonios' },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-background/70 backdrop-blur-md border-b border-muted">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="font-extrabold text-lg">
          <span
            style={{
              backgroundImage: 'var(--primary-gradient)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
            }}
          >
            TACTIVO
          </span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l.title}
              href={l.href}
              className="text-neutral-900 hover:text-primary transition-colors"
            >
              {l.title}
            </a>
          ))}
        </div>

        {/* Right actions */}
        <div className="hidden md:flex items-center gap-4">
          {/* Login button - Aceternity-style lit border (gold) */}
          <a
            href="/login"
            className="p-[3px] relative rounded-[6px] overflow-hidden"
            aria-label="Iniciar sesión"
          >
            <div
              className="absolute inset-0 rounded-[6px]"
              style={{ background: 'var(--primary-gradient)' }}
              aria-hidden
            />
            <div className="h-9 px-4 inline-flex items-center justify-center bg-white text-neutral-900 rounded-[6px] relative group transition duration-200 hover:bg-transparent hover:text-white">
              Iniciar sesión
            </div>
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-md border border-muted text-neutral-900"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-muted bg-background/95">
          <div className="px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.title}
                href={l.href}
                className="text-neutral-900 hover:text-primary transition-colors"
              >
                {l.title}
              </a>
            ))}
            <a href="/login" className="text-primary transition-colors font-semibold">
              Iniciar sesión
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
