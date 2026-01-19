import { describe, test, expect } from 'vitest';
import { computeAppointmentSlots } from '@/components/eventos/AppointmentSlotsDialog';

describe('computeAppointmentSlots', () => {
  const company = {
    id: 'c1',
    default_appointment_duration: 30,
    open_time: '08:00',
    close_time: '20:00',
  } as any;

  const pro1 = { id: 'p1', user: 'p1', company: 'c1', name: 'A' } as any;
  const pro2 = { id: 'p2', user: 'p2', company: 'c1', name: 'B' } as any;

  const baseNow = new Date('2026-01-14T09:50:00');

  test('two professionals free -> two slots at 10:00', () => {
    const slots = computeAppointmentSlots({
      now: baseNow,
      company,
      events: [],
      professionals: [pro1, pro2],
      maxResults: 5,
    });
    const at10 = slots.filter((s) => s.start.getHours() === 10 && s.start.getMinutes() === 0);
    expect(at10.length).toBe(2);
  });

  test('one professional busy -> one slot', () => {
    const events = [
      {
        _rawEvent: {
          datetime: '2026-01-14T10:00',
          duration: 30,
          professional: ['p1'],
          company: 'c1',
        },
      },
    ];

    const slots = computeAppointmentSlots({
      now: baseNow,
      company,
      events,
      professionals: [pro1, pro2],
      maxResults: 5,
    });
    const at10 = slots.filter((s) => s.start.getHours() === 10 && s.start.getMinutes() === 0);
    expect(at10.length).toBe(1);
    const p = at10[0].professional;
    expect(p && (p.id === 'p2' || p.user === 'p2')).toBeTruthy();
  });

  test('both busy -> no slots', () => {
    const events = [
      {
        _rawEvent: {
          datetime: '2026-01-14T10:00',
          duration: 30,
          professional: ['p1'],
          company: 'c1',
        },
      },
      {
        _rawEvent: {
          datetime: '2026-01-14T10:00',
          duration: 30,
          professional: ['p2'],
          company: 'c1',
        },
      },
    ];

    const slots = computeAppointmentSlots({
      now: baseNow,
      company,
      events,
      professionals: [pro1, pro2],
      maxResults: 5,
    });
    const at10 = slots.filter((s) => s.start.getHours() === 10 && s.start.getMinutes() === 0);
    expect(at10.length).toBe(0);
  });

  test('filter by professionalId -> only that professional slots', () => {
    const slotsAll = computeAppointmentSlots({
      now: baseNow,
      company,
      events: [],
      professionals: [pro1, pro2],
      maxResults: 5,
    });
    const at10All = slotsAll.filter((s) => s.start.getHours() === 10 && s.start.getMinutes() === 0);
    expect(at10All.length).toBe(2);

    const slotsPro2 = computeAppointmentSlots({
      now: baseNow,
      company,
      events: [],
      professionals: [pro1, pro2],
      maxResults: 5,
      professionalId: 'p2',
    });
    const at10Pro2 = slotsPro2.filter(
      (s) => s.start.getHours() === 10 && s.start.getMinutes() === 0
    );
    expect(at10Pro2.length).toBe(1);
    expect(
      at10Pro2[0].professional &&
        (at10Pro2[0].professional.id === 'p2' || at10Pro2[0].professional.user === 'p2')
    ).toBeTruthy();

    const slotsPro1Busy = computeAppointmentSlots({
      now: baseNow,
      company,
      events: [
        {
          _rawEvent: {
            datetime: '2026-01-14T10:00',
            duration: 30,
            professional: ['p1'],
            company: 'c1',
          },
        },
      ],
      professionals: [pro1, pro2],
      maxResults: 5,
      professionalId: 'p1',
    });
    const at10Pro1Busy = slotsPro1Busy.filter(
      (s) => s.start.getHours() === 10 && s.start.getMinutes() === 0
    );
    expect(at10Pro1Busy.length).toBe(0);
  });
});
