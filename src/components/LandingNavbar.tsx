import React, { useState } from 'react';

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { title: 'Funcionalidades', href: '#funcionalidades' },
    { title: 'Testimonios', href: '#testimonios' },
    { title: 'Planes', href: '#planes' },
    { title: 'Preguntas frecuentes', href: '#preguntas-frecuentes' },
    { title: 'Próximamente', href: '#proximamente' },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-background/70 backdrop-blur-md border-b border-muted landing-navbar">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center relative">
        {/* Mobile menu toggle - left on mobile */}
        <button
          className="md:hidden p-2 rounded-md text-neutral-900 mr-2 focus:outline-none focus:ring-2 focus:ring-primary"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          ☰
        </button>

        {/* Logo: centered on mobile, static on desktop */}
        <a href="/" className="flex items-center text-lg font-extrabold md:static absolute left-1/2 transform -translate-x-1/2 md:translate-x-0 md:left-auto z-10">
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

        {/* Center: navigation */}
        <div className="hidden md:flex items-center gap-6 flex-1 justify-center">
          {links.map((l) => (
            <a
              key={l.title}
              href={l.href}
              className="landing-nav-link text-neutral-900 transition-colors"
            >
              {l.title}
            </a>
          ))}
        </div>

        {/* Right: actions */}
        <div className="ml-auto flex items-center gap-4">
          <a
            href="/login"
            className="hidden md:inline-flex p-[3px] relative rounded-[6px] overflow-hidden"
            aria-label="Acceso"
          >
            <div
              className="absolute inset-0 rounded-[6px]"
              style={{ background: 'var(--primary-gradient)' }}
              aria-hidden
            />
            <div className="h-9 px-4 inline-flex items-center justify-center bg-white text-neutral-900 rounded-[6px] relative group transition duration-200 hover:bg-transparent hover:text-white">
              Acceso
            </div>
          </a>

          {/* Mobile login button - right on mobile */}
          <a
            href="/login"
            className="md:hidden h-7 px-2 inline-flex items-center justify-center rounded-[6px] text-white text-sm ml-2"
            style={{ background: 'var(--primary-gradient)' }}
            aria-label="Acceso"
          >
            Acceso
          </a>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-muted bg-background/95">
          <div className="px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.title}
                href={l.href}
                className="landing-nav-link text-neutral-900 transition-colors"
              >
                {l.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
