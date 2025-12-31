export function formatApiError(err: any, options?: { field?: string }): string {
    const raw = err?.response?.data?.message || err?.message || String(err) || ''

    // Generic translation for common validation message
    if (raw === 'An error occurred while validating the submitted data.') {
        if (options?.field === 'reset-email') return 'Email no válido'
        return 'Ocurrió un error al validar los datos enviados.'
    }

    // Fallback
    return String(raw)
}
