import React, { useEffect, useState } from 'react';

type Props = {
  phrases: string[];
  className?: string;
  typingSpeed?: number; // ms per char
  deletingSpeed?: number; // ms per char
  pause?: number; // pause after completing a phrase
  loop?: boolean;
};

export default function Typewriter({
  phrases,
  className,
  typingSpeed = 80,
  deletingSpeed = 40,
  pause = 1200,
  loop = true,
}: Props) {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (completed) return;
    if (!phrases || phrases.length === 0) return;

    let mounted = true;
    const currentPhrase = phrases[phraseIndex % phrases.length];

    const timeout = window.setTimeout(
      () => {
        if (!mounted) return;

        if (!isDeleting) {
          // typing
          const next = currentPhrase.slice(0, text.length + 1);
          setText(next);
          if (next === currentPhrase) {
            // If loop is disabled and this is the last phrase, stop here.
            if (!loop && phraseIndex === phrases.length - 1) {
              setCompleted(true);
              return;
            }
            // pause then start deleting
            window.setTimeout(() => {
              if (!mounted) return;
              setIsDeleting(true);
            }, pause);
          }
        } else {
          // deleting
          const next = currentPhrase.slice(0, text.length - 1);
          setText(next);
          if (next === '') {
            setIsDeleting(false);
            setPhraseIndex((i) => i + 1);
          }
        }
      },
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [text, isDeleting, phraseIndex, phrases, typingSpeed, deletingSpeed, pause, loop, completed]);

  // When phrases array changes, reset
  useEffect(() => {
    setText('');
    setIsDeleting(false);
    setPhraseIndex(0);
    setCompleted(false);
  }, [phrases]);

  return (
    <span className={className} aria-live="polite">
      <span className="typewriter">
        <span className="typewriter-text">{text}</span>
        <span className={`typewriter-caret ${completed ? 'hidden' : ''}`} aria-hidden={completed} />
      </span>
    </span>
  );
}
