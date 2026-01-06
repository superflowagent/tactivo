import { describe, it, expect } from 'vitest'
import { normalizeForSearch } from '../stringUtils'

describe('normalizeForSearch', () => {
    it('removes accents and lowercases', () => {
        expect(normalizeForSearch('García')).toBe('garcia')
        expect(normalizeForSearch('José López')).toBe('jose lopez')
    })

    it('collapses whitespace and hyphens', () => {
        expect(normalizeForSearch('Juan--Carlos')).toBe('juan carlos')
        expect(normalizeForSearch('  Ana   Maria  ')).toBe('ana maria')
    })

    it('works with numbers and emails', () => {
        expect(normalizeForSearch('12345678A')).toBe('12345678a')
        expect(normalizeForSearch('User@Example.com')).toBe('user@example.com')
    })
})
