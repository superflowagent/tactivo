import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shouldAutoFocus(): boolean {
  // On server (SSR), allow autofocus by default
  if (typeof window === 'undefined') return true

  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches)

  // Only autofocus when NOT a touch device
  return !hasTouch
}
