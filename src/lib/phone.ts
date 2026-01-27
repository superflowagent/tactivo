/**
 * Extracts a phone number from different possible inputs.
 *
 * - If given a string or number, returns only digits if any.
 * - If given an object, inspects common phone fields and returns the first digits-only candidate.
 * - Returns null when no usable digits are found.
 */
export function extractPhone(value: any): string | null {
    if (value === null || value === undefined) return null;

    // Direct string/number cases
    if (typeof value === 'string' || typeof value === 'number') {
        const digits = String(value).replace(/\D/g, '');
        return digits || null;
    }

    // Objects: check common candidate keys in order
    const keys = ['phone', 'movil', 'mobile', 'telefono', 'phone_number', 'cell'];
    for (const k of keys) {
        const v = value[k];
        if (v !== undefined && v !== null) {
            const digits = String(v).replace(/\D/g, '');
            if (digits) return digits;
        }
    }

    return null;
}

export default extractPhone;
