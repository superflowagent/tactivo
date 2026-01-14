import { describe, it, expect } from 'vitest';
import { normalizeProgramExercises } from '../useClientPrograms';

describe('normalizeProgramExercises', () => {
  it('compacts days and reassigns day letters when there are gaps', () => {
    // A: 2 exercises, B: 0, C: 1 exercise
    const peList = [
      { id: '1', day: 'A', position: 0 },
      { id: '2', day: 'A', position: 1 },
      { id: '3', day: 'C', position: 0 },
    ];

    const { normalized, daysCompact } = normalizeProgramExercises(peList, ['A', 'B', 'C']);

    // Expect days to become A and B (compact), and the third exercise day remapped from C to B
    expect(daysCompact).toEqual(['A', 'B']);
    const aItems = normalized.filter((p) => p.day === 'A');
    const bItems = normalized.filter((p) => p.day === 'B');

    expect(aItems.length).toBe(2);
    expect(bItems.length).toBe(1);
    expect(bItems[0].id).toBe('3');
  });

  it('orders days alphabetically regardless of input order', () => {
    // Input days are out of order (C,A,B) - output should be A,B,C mapping
    const peList = [
      { id: '1', day: 'C', position: 0 },
      { id: '2', day: 'A', position: 0 },
      { id: '3', day: 'B', position: 0 },
    ];

    const { normalized, daysCompact } = normalizeProgramExercises(peList, ['C', 'A', 'B']);

    expect(daysCompact).toEqual(['A', 'B', 'C']);
    expect(normalized.filter((p) => p.day === 'A').length).toBe(1);
    expect(normalized.filter((p) => p.day === 'B').length).toBe(1);
    expect(normalized.filter((p) => p.day === 'C').length).toBe(1);
  });
});
