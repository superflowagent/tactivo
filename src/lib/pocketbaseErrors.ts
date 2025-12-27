export function formatPocketbaseError(err: any, options?: { field?: string }): string {
    const raw = err?.response?.data?.message || err?.message || String(err) || ''

    // Common exact-match translations
    if (raw === 'An error occurred while validating the submitted data.') {
        if (options?.field === 'reset-email') return 'Email no válido'
        return 'Ocurrió un error al validar los datos enviados.'
    }

    // Add other specific mappings here as needed

    // Fallback
    return String(raw)
}
