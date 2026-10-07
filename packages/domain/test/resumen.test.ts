import { describe, expect, it } from 'vitest';

import { resumirHorario, type FranjaSemanal } from '../src/index.js';
import { reglaMicrocentro } from './fixtures.js';

describe('resumirHorario', () => {
  it('agrupa días consecutivos con el mismo horario', () => {
    expect(resumirHorario(reglaMicrocentro.horario)).toBe('Lun a Vie 8 a 20 · Sáb 8 a 13');
  });

  it('muestra horarios partidos, minutos y la medianoche', () => {
    const horario: FranjaSemanal[] = [
      { dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '12:30' },
      { dias: [1, 2, 3, 4, 5], desde: '16:00', hasta: '20:00' },
      { dias: [6, 0], desde: '20:00', hasta: '24:00' },
    ];
    expect(resumirHorario(horario)).toBe('Lun a Vie 8 a 12:30 y 16 a 20 · Sáb y Dom 20 a 24');
  });

  it('no mezcla días que no son consecutivos', () => {
    const horario: FranjaSemanal[] = [{ dias: [1, 3], desde: '09:00', hasta: '12:00' }];
    expect(resumirHorario(horario)).toBe('Lun 9 a 12 · Mié 9 a 12');
  });

  it('sin franjas devuelve un texto vacío', () => {
    expect(resumirHorario([])).toBe('');
  });
});
