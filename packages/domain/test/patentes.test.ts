import { describe, expect, it } from 'vitest';

import { esPatenteValida, formatoDePatente, normalizarPatente } from '../src/index.js';

describe('patentes', () => {
  it.each([
    ['AB123CD', 'AB123CD', 'auto-mercosur'],
    ['ab 123 cd', 'AB123CD', 'auto-mercosur'],
    ['AB-123-CD', 'AB123CD', 'auto-mercosur'],
    ['abc123', 'ABC123', 'auto-1995'],
    ['ABC 123', 'ABC123', 'auto-1995'],
    ['123ABC', '123ABC', 'moto-1995'],
    ['A123BCD', 'A123BCD', 'moto-mercosur'],
  ])('normaliza "%s" → %s (%s)', (entrada, esperada, formato) => {
    const patente = normalizarPatente(entrada);
    expect(patente).toBe(esperada);
    expect(formatoDePatente(patente)).toBe(formato);
  });

  it.each(['', 'AB12CD', 'ABCD123', 'AB1234CD', '1234', 'ÑB123CD', 'AB123C'])(
    'rechaza "%s"',
    (entrada) => {
      expect(() => normalizarPatente(entrada)).toThrow(
        expect.objectContaining({ codigo: 'PATENTE_INVALIDA' }),
      );
      expect(esPatenteValida(entrada)).toBe(false);
    },
  );

  it('acepta patentes válidas sin lanzar', () => {
    expect(esPatenteValida('AB123CD')).toBe(true);
  });
});
