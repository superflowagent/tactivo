// Utilities for normalizing strings for search

export function normalizeForSearch(s: string) {
  return (
    (s || '')
      .normalize('NFD')
      // remove combining diacritical marks (e.g., accents)
      .replace(/[\u0300-\u036f]/g, '')
      // collapse hyphens and multiple whitespace to single space
      .replace(/[\-\s]+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

/**
 * Sanitize a filename for storage keys.
 * - Removes diacritics
 * - Replaces whitespace and unsafe characters with hyphen
 * - Preserves and lowercases extension
 */
export function sanitizeFilename(filename: string) {
  if (!filename) return 'file';
  const parts = filename.split('.');
  const ext = parts.length > 1 ? '.' + parts.pop() : '';
  const name = parts.join('.') || 'file';
  // Normalize and remove diacritics
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  // Replace any non-word characters (except dot, underscore, hyphen) with hyphen
  const safe = normalized
    .replace(/[^\w\-_.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_\.]+|[-_\.]+$/g, '')
    .toLowerCase();
  const safeExt = ext.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return `${safe || 'file'}${safeExt}`;
}
