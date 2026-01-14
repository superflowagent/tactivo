import { describe, it, expect } from 'vitest';
import { mapProfileRowsToMap } from '@/lib/profiles';

describe('mapProfileRowsToMap', () => {
  it('maps rows by id and user and computes photoUrl', () => {
    const rows = [
      {
        id: '709f2b31-47fc-496a-8e6a-bbdb8dfe8109',
        user: 'c980896d-16e1-4843-9133-b213ad1d39e5',
        name: 'a',
        last_name: 'a',
        photo_path: null,
      },
      {
        id: 'fff9d2f0-fc76-459e-8696-2d9c0aec851a',
        user: 'b0001023-d740-4681-a75b-7c37976dbb0f',
        name: 'Victor',
        last_name: 'Profe',
        photo_path: '1767613072647-40adee67-2883-44bf-ac5a-e41ea4d58f70.jpg',
      },
    ];

    const map = mapProfileRowsToMap(rows as any);

    // Both ids and user ids should be keys
    expect(map['709f2b31-47fc-496a-8e6a-bbdb8dfe8109']).toBeTruthy();
    expect(map['c980896d-16e1-4843-9133-b213ad1d39e5']).toBeTruthy();
    expect(map['fff9d2f0-fc76-459e-8696-2d9c0aec851a']).toBeTruthy();
    expect(map['b0001023-d740-4681-a75b-7c37976dbb0f']).toBeTruthy();

    // Names should match
    expect(map['b0001023-d740-4681-a75b-7c37976dbb0f'].name).toBe('Victor');
    expect(map['c980896d-16e1-4843-9133-b213ad1d39e5'].name).toBe('a');
  });
});
