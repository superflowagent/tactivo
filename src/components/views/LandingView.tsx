import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { LandingNavbar } from '@/components/LandingNavbar';
import { loadGtag } from '@/lib/gtag';
import { HeroHighlight, Highlight } from '@/components/ui/hero-highlight';
import CalendarPreview from '@/components/ui/CalendarPreview';
import FeaturesSection from '@/components/views/FeaturesSection';
import TestimoniosSection from '@/components/views/TestimoniosSection';
import PlanesSection from '@/components/views/PlanesSection';
import ProximamenteSection from '@/components/views/ProximamenteSection';
import FAQSection from '@/components/views/FAQSection';
import { LandingFooter } from '@/components/LandingFooter';
import Reveal from '@/components/ui/Reveal';

export function LandingView() {
  useEffect(() => {
    loadGtag('AW-17912605308')
      .then(() => {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
          window.gtag('config', 'AW-17912605308');
        }
      })
      .catch(() => {
        /* ignore errors loading analytics */
      });
  }, []);

  return (
    <div className="min-h-[72vh] w-full bg-background relative overflow-hidden pt-16">
      <LandingNavbar />

      {/* Decorative animated background blob */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 0.18, scale: [1, 1.05, 1], x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        className="absolute -z-10 w-[36rem] h-[36rem] rounded-full bg-gradient-to-r from-primary/30 to-accent/10 blur-3xl"
        aria-hidden
      />

      <Reveal>
        <HeroHighlight containerClassName="w-full">
          <div className="w-full min-h-[520px] relative flex flex-col lg:flex-row">
            {/* Left half: title and subtitle aligned to the right (towards center) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center py-12 px-8 lg:pl-64">
              <motion.div
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: [20, -5, 0],
                }}
                transition={{
                  duration: 0.5,
                  ease: [0.4, 0.0, 0.2, 1],
                }}
                className="text-center"
              >
                <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
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
                    Tactivo
                  </span>
                </h2>



                <h1 className="mt-3 text-2xl md:text-3xl lg:text-4xl font-bold text-neutral-900 dark:text-white leading-relaxed lg:leading-relaxed">
                  el software de gestión
                  <br />
                  para fisioterapeutas
                  <br />
                  <Highlight className="text-black dark:text-white">que te libera.</Highlight>
                </h1>
              </motion.div>
            </div>

            {/* Right half: calendar preview aligned to the left (towards center) */}
            <div className="flex w-full lg:w-1/2 items-center justify-start pl-6 pr-6 lg:pl-12 lg:pr-48 mt-6 lg:mt-0">
              <CalendarPreview />
            </div>
          </div>

          <div className="w-full flex justify-center mt-8 md:mt-10 px-4 sm:px-0">
            <a href="#planes" role="note" aria-label="Oferta de lanzamiento: Plan Fundador gratuito" className="block sm:inline-flex items-center gap-3 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-white shadow-sm text-center w-full sm:w-auto max-w-[calc(100%-2rem)]" style={{ background: 'var(--primary-gradient)' }}>
              <span className="">Aprovecha oferta de lanzamiento:</span>
              <br className="sm:hidden" />
              <span className="font-semibold">Plan Fundador totalmente gratuito ✅</span>
            </a>
          </div>
        </HeroHighlight>
      </Reveal>
      {/* Planes (placeholder) */}
      <Reveal className="mt-6">
        <FeaturesSection />
      </Reveal>

      <Reveal>
        <TestimoniosSection />
      </Reveal>

      <Reveal>
        <PlanesSection />
      </Reveal>

      <Reveal>
        <FAQSection />
      </Reveal>

      <Reveal>
        <ProximamenteSection />
      </Reveal>

      <Reveal>
        <LandingFooter />
      </Reveal>
    </div>
  );
}
