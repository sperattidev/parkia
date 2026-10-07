import { describe, expect, it } from 'vitest';

import { centavos, pesos, vencimientoAlIniciar } from '../src/index.js';
import { ar, reglaMicrocentro as regla } from './fixtures.js';

describe('vencimientoAlIniciar', () => {
  it('devuelve el vencimiento cubierto por el saldo', () => {
    expect(vencimientoAlIniciar(regla, ar('2026-10-05T10:00'), pesos(500))).toEqual(
      ar('2026-10-05T10:30'),
    );
  });

  it('rechaza iniciar en horario de cobro si el saldo no cubre el mínimo', () => {
    for (const saldo of [centavos(0), pesos(499)]) {
      expect(() => vencimientoAlIniciar(regla, ar('2026-10-05T10:00'), saldo)).toThrow(
        expect.objectContaining({ codigo: 'SALDO_INSUFICIENTE' }),
      );
    }
  });

  it('fuera del horario permite iniciar y vence al terminar la tolerancia de la próxima jornada', () => {
    // Viernes a la noche sin saldo: cubre hasta el sábado 08:05.
    expect(vencimientoAlIniciar(regla, ar('2026-10-09T21:00'), centavos(0))).toEqual(
      ar('2026-10-10T08:05'),
    );
  });

  it('con saldo de sobra no vence dentro del horizonte', () => {
    expect(vencimientoAlIniciar(regla, ar('2026-10-05T10:00'), pesos(1_000_000))).toBeNull();
  });
});
