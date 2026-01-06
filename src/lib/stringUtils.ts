// Utilities for normalizing strings for search

export function normalizeForSearch(s: string) {
    return (s || '')
        .normalize('NFD')
        // remove combining diacritical marks (e.g., accents)
        .replace(/[\u0300-\u036f]/g, '')
        // collapse hyphens and multiple whitespace to single space
        .replace(/[\-\s]+/g, ' ')
        .trim()
        .toLowerCase();
}
