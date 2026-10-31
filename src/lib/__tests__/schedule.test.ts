// Pruebas de la lógica de horarios: tipo de día y próximas salidas.
// Las fechas se crean con new Date(año, mes, día, hora, min) en hora local.
import type { Line } from '@/data/schema';
import {
  calendarDays,
  dayTypeFor,
  directionLabel,
  headsignFor,
  holidayFor,
  nextDepartures,
  notesAt,
} from '@/lib/schedule';

describe('dayTypeFor', () => {
  it('weekday is lab', () => {
    expect(dayTypeFor(new Date(2026, 9, 28), [])).toBe('lab');
  });
  it('saturday is sab', () => {
    expect(dayTypeFor(new Date(2026, 9, 31), [])).toBe('sab');
  });
  it('sunday is fes', () => {
    expect(dayTypeFor(new Date(2026, 10, 1), [])).toBe('fes');
  });
  it('local holiday is fes', () => {
    const holiday = { date: '2026-05-11', name: 'Fiesta local de Jerez', scope: 'local' as const };
    const d = new Date(2026, 4, 11);
    expect(dayTypeFor(d, [holiday])).toBe('fes');
    expect(holidayFor(d, [holiday])).toEqual(holiday);
  });
});

describe('nextDepartures', () => {
  const times = ['07:28', '10:14', '10:37', '11:01'];
  it('next departures', () => {
    expect(nextDepartures(times, new Date(2026, 9, 28, 10, 5), 2)).toEqual([
      { time: '10:14', minutesUntil: 9 },
      { time: '10:37', minutesUntil: 32 },
    ]);
  });
  it('includes a departure at the exact minute', () => {
    const r = nextDepartures(times, new Date(2026, 9, 28, 10, 14, 30), 1);
    expect(r[0]).toEqual({ time: '10:14', minutesUntil: 0 });
  });
  it('no more buses today', () => {
    expect(nextDepartures(['07:28', '21:38'], new Date(2026, 9, 28, 23, 30), 3)).toEqual([]);
  });
});

describe('headsignFor', () => {
  it('headsign', () => {
    const l = {
      directions: [
        { headsign: 'San Telmo', stopCodes: ['343'] },
        { headsign: 'Plaza Esteve', stopCodes: ['302'] },
      ],
    } as unknown as Line;
    expect(headsignFor(l, '302')).toBe('Plaza Esteve');
    expect(headsignFor(l, '999')).toBeNull();
  });
});

describe('directionLabel', () => {
  it('con dos sentidos devuelve el destino de la parada', () => {
    const l = {
      directions: [
        { headsign: 'San Telmo', stopCodes: ['343'] },
        { headsign: 'Plaza Esteve', stopCodes: ['302'] },
      ],
    } as unknown as Line;
    expect(directionLabel(l, '302')).toBe('Plaza Esteve');
    expect(directionLabel(l, '999')).toBeNull();
  });
  it('con un solo sentido (o ninguno) no hay "hacia": devuelve null', () => {
    const una = { directions: [{ headsign: 'Circular', stopCodes: ['1'] }] } as unknown as Line;
    expect(directionLabel(una, '1')).toBeNull();
    expect(directionLabel({ directions: [] } as unknown as Line, '1')).toBeNull();
  });
});

describe('calendarDays', () => {
  it('calendar', () => {
    const days = calendarDays(new Date(2026, 9, 28), 14, []);
    expect(days).toHaveLength(14);
    expect(days[0].dayType).toBe('lab');
    expect(days[3].dayType).toBe('sab');
    expect(days[4].dayType).toBe('fes');
    expect(days[0].key).toBe('2026-10-28');
  });
});

describe('notesAt', () => {
  const line = {
    id: '1',
    stopCodes: ['343', '302', '418'],
    notes: {
      lab: [
        { mark: 'a', text: 'Retirada en Moreno Mendoza', endsAt: '302', times: { '343': '21:38', '302': '21:50' } },
        { mark: 'b', text: 'Paso por Parque Tecnológico', times: { '418': '07:10' } },
      ],
      sab: [],
      fes: [],
    },
  } as unknown as Line;

  it('marks the time at that stop and returns only the letters used there', () => {
    expect(notesAt(line, 'lab', '343')).toEqual({
      marks: { '21:38': 'a' },
      legend: [{ mark: 'a', text: 'Retirada en Moreno Mendoza', endsAt: '302' }],
    });
  });

  it('is empty without notes', () => {
    expect(notesAt(line, 'sab', '343')).toEqual({ marks: {}, legend: [] });
    expect(notesAt({ ...line, notes: undefined }, 'lab', '343')).toEqual({ marks: {}, legend: [] });
  });
});
