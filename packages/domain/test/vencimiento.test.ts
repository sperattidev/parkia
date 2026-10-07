import { describe, expect, it } from 'vitest';

import { calcularVencimiento, centavos, pesos } from '../src/index.js';
import { ar, reglaMicrocentro as regla } from './fixtures.js';

describe('calcularVencimiento', () => {
  it('devuelve el último instante cubierto por el saldo', () => {
    // $500 cubren el mínimo de 30 min; el minuto 31 ya cuesta $750.
    expect(calcularVencimiento(regla, ar('2026-10-05T10:00'), pesos(500))).toEqual(
      ar('2026-10-05T10:30'),
    );
  });

  it('con saldo cero dura lo que dura la tolerancia', () => {
    expect(calcularVencimiento(regla, ar('2026-10-05T10:00'), centavos(0))).toEqual(
      ar('2026-10-05T10:05'),
    );
  });

  it('salta el tiempo fuera del horario de cobro', () => {
    // Lunes 19:50–20:00 consume el mínimo ($500); el martes recién vence
    // al terminar la tolerancia de la nueva jornada.
    expect(calcularVencimiento(regla, ar('2026-10-05T19:50'), pesos(500))).toEqual(
      ar('2026-10-06T08:05'),
    );
  });

  it('devuelve null si el saldo alcanza para todo el horizonte', () => {
    expect(calcularVencimiento(regla, ar('2026-10-05T10:00'), pesos(1_000_000))).toBeNull();
  });

  it('respeta un horizonte personalizado', () => {
    expect(calcularVencimiento(regla, ar('2026-10-05T10:00'), pesos(500), 20)).toBeNull();
  });

  it('rechaza horizontes inválidos', () => {
    for (const horizonte of [0, -5, 1.5, 32 * 24 * 60]) {
      expect(() =>
        calcularVencimiento(regla, ar('2026-10-05T10:00'), pesos(500), horizonte),
      ).toThrow(expect.objectContaining({ codigo: 'HORIZONTE_INVALIDO' }));
    }
  });
});
