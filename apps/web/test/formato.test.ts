import { describe, expect, it } from 'vitest';

import { duracion, hora, horaConDia, pesos } from '@/lib/formato';

const ar = (fechaHora: string) => new Date(`${fechaHora}-03:00`);

describe('formato', () => {
  it('muestra la hora local del municipio', () => {
    expect(hora('2026-10-07T22:17:00Z')).toBe('19:17');
  });

  it('agrega el día cuando el vencimiento no es hoy', () => {
    const ahora = ar('2026-10-07T19:17');
    expect(horaConDia(ar('2026-10-07T19:45').toISOString(), ahora)).toBe('19:45');
    expect(horaConDia(ar('2026-10-08T08:05').toISOString(), ahora)).toBe('mañana 08:05');
    expect(horaConDia(ar('2026-10-12T08:05').toISOString(), ahora)).toMatch(/^lun 12 oct 08:05$/);
  });

  it('formatea duraciones', () => {
    expect(duracion(45 * 60_000)).toBe('45 min');
    expect(duracion(65 * 60_000)).toBe('1 h 05 min');
    expect(duracion(-1)).toBe('0 min');
  });

  it('formatea pesos desde centavos', () => {
    expect(pesos(137_500)).toMatch(/^\$\s1\.375,00$/);
  });
});
