import { motion } from 'motion/react';
import { LandingNavbar } from '@/components/LandingNavbar';
import { HeroHighlight, Highlight } from '@/components/ui/hero-highlight';
import CalendarPreview from '@/components/ui/CalendarPreview';
import Typewriter from '@/components/ui/typewriter';
import FeaturesSection from '@/components/views/FeaturesSection';

const FEATURES_PHRASES = ['Funcionalidades'];

export function LandingView() {
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

      <HeroHighlight containerClassName="w-full">
        <div className="w-full min-h-[520px] flex flex-col lg:flex-row">
          {/* Left half: title and subtitle aligned to the right (towards center) */}
          <div className="w-full lg:w-1/2 flex items-center justify-end py-12 pl-12 pr-8">
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
                <span style={{ backgroundImage: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>
                  Tactivo
                </span>
              </h2>

              <h1 className="mt-3 text-2xl md:text-3xl lg:text-4xl font-bold text-neutral-900 dark:text-white leading-relaxed lg:leading-snug">
                el software de gestión para fisioterapeutas<br />
                <Highlight className="text-black dark:text-white">que te libera.</Highlight>
              </h1>
            </motion.div>
          </div>

          {/* Right half: calendar preview aligned to the left (towards center) */}
          <div className="hidden lg:flex w-1/2 items-center justify-start pl-8 pr-12">
            <CalendarPreview />
          </div>
        </div>
      </HeroHighlight>

      <div className="w-full py-8 mt-6 lg:mt-8">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6">
            <Typewriter phrases={["Funcionalidades"]} typingSpeed={80} deletingSpeed={40} loop={false} />
          </h3>
        </div>

        {/* Full width features section */}
        <FeaturesSection />
      </div>

    </div>
  );
}
