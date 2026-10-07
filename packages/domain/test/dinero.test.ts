import { describe, expect, it } from 'vitest';

import { centavos, formatearPesos, pesos, sumarCentavos } from '../src/index.js';

describe('dinero', () => {
  it('convierte pesos a centavos sin errores de punto flotante', () => {
    expect(pesos(0.1 + 0.2)).toBe(30);
    expect(pesos(1375.5)).toBe(137_550);
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rechaza %s centavos', (valor) => {
    expect(() => centavos(valor)).toThrow(expect.objectContaining({ codigo: 'DINERO_INVALIDO' }));
  });

  it('suma importes', () => {
    expect(sumarCentavos(pesos(250), pesos(375))).toBe(pesos(625));
    expect(sumarCentavos()).toBe(0);
  });

  it('formatea en pesos argentinos', () => {
    expect(formatearPesos(pesos(1375))).toMatch(/^\$\s1\.375,00$/);
  });
});
