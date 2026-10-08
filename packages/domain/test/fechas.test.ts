import { describe, expect, it } from 'vitest';

import { fechaLocal, fechasEntre, inicioDeFecha, sumarDias } from '../src/fechas.js';
import type { FechaLocal } from '../src/tarifas/tipos.js';

const AR = 'America/Argentina/Buenos_Aires';
const f = (fecha: string) => fecha as FechaLocal;

describe('fechas locales', () => {
  it('la fecha depende de la zona horaria, no de UTC', () => {
    // 01:30 UTC del 6/10 todavía es el 5/10 en Argentina.
    expect(fechaLocal(new Date('2026-10-06T01:30:00Z'), AR)).toBe('2026-10-05');
    expect(fechaLocal(new Date('2026-10-06T03:00:00Z'), AR)).toBe('2026-10-06');
  });

  it('el inicio de una fecha es su medianoche local', () => {
    expect(inicioDeFecha(f('2026-10-05'), AR).toISOString()).toBe('2026-10-05T03:00:00.000Z');
  });

  it('suma días atravesando meses y años', () => {
    expect(sumarDias(f('2026-12-30'), 3)).toBe('2027-01-02');
    expect(sumarDias(f('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('lista las fechas de un período, ambas puntas incluidas', () => {
    expect(fechasEntre(f('2026-09-29'), f('2026-10-02'))).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(fechasEntre(f('2026-10-02'), f('2026-10-01'))).toEqual([]);
  });
});
