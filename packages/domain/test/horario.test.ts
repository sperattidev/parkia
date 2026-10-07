import { describe, expect, it } from 'vitest';

import { ErrorDeDominio, estaEnHorarioDeCobro } from '../src/index.js';
import { ar, reglaMicrocentro as regla } from './fixtures.js';

describe('estaEnHorarioDeCobro', () => {
  it.each([
    ['2026-10-05T07:59', false],
    ['2026-10-05T08:00', true],
    ['2026-10-05T19:59', true],
    ['2026-10-05T20:00', false],
    ['2026-10-10T12:59', true],
    ['2026-10-10T13:00', false],
    ['2026-10-11T12:00', false],
    ['2026-10-12T12:00', false],
  ])('%s → %s', (instante, esperado) => {
    expect(estaEnHorarioDeCobro(regla, ar(instante))).toBe(esperado);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => estaEnHorarioDeCobro(regla, new Date('no-es-fecha'))).toThrow(ErrorDeDominio);
  });
});
