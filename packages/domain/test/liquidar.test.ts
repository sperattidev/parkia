import { describe, expect, it } from 'vitest';

import {
  ErrorDeDominio,
  liquidarEstacionamiento,
  pesos,
  type ReglaTarifaria,
} from '../src/index.js';
import { ar, reglaMicrocentro as regla } from './fixtures.js';

function costo(inicio: string, fin: string, r: ReglaTarifaria = regla) {
  return liquidarEstacionamiento(r, { inicio: ar(inicio), fin: ar(fin) });
}

describe('liquidarEstacionamiento', () => {
  describe('tolerancia, mínimo y fracción', () => {
    it('no cobra si el tiempo no supera la tolerancia', () => {
      const liquidacion = costo('2026-10-05T10:00', '2026-10-05T10:05');
      expect(liquidacion.importe).toBe(0);
      expect(liquidacion.jornadas[0]).toMatchObject({
        minutosCobrables: 5,
        minutosFacturados: 0,
        enTolerancia: true,
      });
    });

    it('pasada la tolerancia cobra el mínimo', () => {
      const liquidacion = costo('2026-10-05T10:00', '2026-10-05T10:06');
      expect(liquidacion.importe).toBe(pesos(500));
      expect(liquidacion.jornadas[0]?.minutosFacturados).toBe(30);
    });

    it('redondea hacia arriba a la fracción', () => {
      expect(costo('2026-10-05T10:00', '2026-10-05T10:31').importe).toBe(pesos(750));
    });

    it('un minuto empezado cuenta como minuto completo', () => {
      const liquidacion = costo('2026-10-05T10:00:00', '2026-10-05T10:30:01');
      expect(liquidacion.minutosCobrables).toBe(31);
      expect(liquidacion.importe).toBe(pesos(750));
    });

    it('un período vacío no cuesta nada', () => {
      const liquidacion = costo('2026-10-05T10:00', '2026-10-05T10:00');
      expect(liquidacion).toEqual({ importe: 0, minutosCobrables: 0, jornadas: [] });
    });
  });

  describe('tarifa progresiva', () => {
    it('cobra cada fracción al precio del tramo en que comienza', () => {
      // 75 min: 4 fracciones de la 1.ª hora ($250) + 1 de la 2.ª ($375).
      expect(costo('2026-10-05T10:00', '2026-10-05T11:01').importe).toBe(pesos(1375));
    });

    it('tres horas exactas suman los tres tramos', () => {
      expect(costo('2026-10-05T10:00', '2026-10-05T13:00').importe).toBe(pesos(4150));
    });

    it('aplica el tope por jornada', () => {
      const liquidacion = costo('2026-10-05T08:00', '2026-10-05T20:00');
      expect(liquidacion.jornadas[0]).toMatchObject({
        minutosFacturados: 720,
        importeSinTope: pesos(19_000),
        aplicoTope: true,
        importe: pesos(10_000),
      });
      expect(liquidacion.importe).toBe(pesos(10_000));
    });

    it('redondea al centavo el precio de cada fracción', () => {
      const tarifaImpar: ReglaTarifaria = {
        ...regla,
        fraccionMinutos: 1,
        minimoMinutos: 0,
        toleranciaMinutos: 0,
        tramos: [{ desdeMinuto: 0, precioHora: pesos(1000) }],
      };
      // $1.000/h = 1666,67 centavos por minuto → 1667 por fracción.
      expect(costo('2026-10-05T10:00', '2026-10-05T10:03', tarifaImpar).importe).toBe(5001);
    });
  });

  describe('horario de cobro', () => {
    it('solo cobra el tiempo dentro del horario', () => {
      const liquidacion = costo('2026-10-05T19:30', '2026-10-05T21:00');
      expect(liquidacion.minutosCobrables).toBe(30);
      expect(liquidacion.importe).toBe(pesos(500));
    });

    it('no cobra antes de la apertura', () => {
      expect(costo('2026-10-05T06:00', '2026-10-05T08:00').importe).toBe(0);
    });

    it('respeta el horario reducido del sábado', () => {
      const liquidacion = costo('2026-10-10T12:00', '2026-10-10T14:00');
      expect(liquidacion.minutosCobrables).toBe(60);
      expect(liquidacion.importe).toBe(pesos(1000));
    });

    it('no cobra los domingos', () => {
      expect(costo('2026-10-11T09:00', '2026-10-11T18:00').importe).toBe(0);
    });

    it('no cobra en un día especial sin franjas (feriado)', () => {
      expect(costo('2026-10-12T09:00', '2026-10-12T18:00').importe).toBe(0);
    });

    it('usa las franjas del día especial cuando las tiene', () => {
      const conEvento: ReglaTarifaria = {
        ...regla,
        diasEspeciales: [
          { fecha: '2026-10-11', franjas: [{ desde: '10:00', hasta: '14:00' }], motivo: 'Feria' },
        ],
      };
      expect(costo('2026-10-11T09:00', '2026-10-11T11:00', conEvento).minutosCobrables).toBe(60);
    });

    it('admite franjas cortadas (horario partido)', () => {
      const partido: ReglaTarifaria = {
        ...regla,
        horario: [
          { dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '13:00' },
          { dias: [1, 2, 3, 4, 5], desde: '16:00', hasta: '20:00' },
        ],
      };
      // 12:00–17:00: 60 min a la mañana + 60 min a la tarde.
      expect(costo('2026-10-05T12:00', '2026-10-05T17:00', partido).minutosCobrables).toBe(120);
    });

    it('admite una franja hasta las 24:00', () => {
      const nocturno: ReglaTarifaria = {
        ...regla,
        horario: [{ dias: [5], desde: '20:00', hasta: '24:00' }],
      };
      expect(costo('2026-10-09T23:00', '2026-10-10T01:00', nocturno).minutosCobrables).toBe(60);
    });
  });

  describe('varias jornadas', () => {
    it('liquida cada jornada por separado', () => {
      const liquidacion = costo('2026-10-09T19:00', '2026-10-10T09:00');
      expect(liquidacion.jornadas.map((j) => [j.fecha, j.minutosCobrables, j.importe])).toEqual([
        ['2026-10-09', 60, pesos(1000)],
        ['2026-10-10', 60, pesos(1000)],
      ]);
      expect(liquidacion.importe).toBe(pesos(2000));
      expect(liquidacion.minutosCobrables).toBe(120);
    });

    it('omite las jornadas sin tiempo cobrable', () => {
      const liquidacion = costo('2026-10-10T12:00', '2026-10-13T09:00');
      expect(liquidacion.jornadas.map((j) => j.fecha)).toEqual(['2026-10-10', '2026-10-13']);
    });
  });

  describe('zona horaria', () => {
    it('interpreta el horario en la zona horaria del municipio', () => {
      const enUtc: ReglaTarifaria = { ...regla, zonaHoraria: 'UTC' };
      // 06:00–08:00 en Argentina son 09:00–11:00 UTC: dentro del horario en UTC.
      expect(costo('2026-10-05T06:00', '2026-10-05T08:00').importe).toBe(0);
      expect(costo('2026-10-05T06:00', '2026-10-05T08:00', enUtc).minutosCobrables).toBe(120);
    });
  });

  describe('errores', () => {
    it('rechaza un fin anterior al inicio', () => {
      expect(() => costo('2026-10-05T11:00', '2026-10-05T10:00')).toThrow(
        expect.objectContaining({ codigo: 'PERIODO_INVALIDO' }),
      );
    });

    it('rechaza fechas inválidas', () => {
      expect(() =>
        liquidarEstacionamiento(regla, { inicio: new Date('no-es-fecha'), fin: new Date() }),
      ).toThrow(ErrorDeDominio);
    });

    it('rechaza períodos de más de 31 días', () => {
      expect(() => costo('2026-10-01T10:00', '2026-11-02T10:00')).toThrow(
        expect.objectContaining({ codigo: 'PERIODO_DEMASIADO_LARGO' }),
      );
    });

    it('valida la regla antes de calcular', () => {
      expect(() => costo('2026-10-05T10:00', '2026-10-05T11:00', { ...regla, tramos: [] })).toThrow(
        expect.objectContaining({ codigo: 'TRAMOS_VACIOS' }),
      );
    });
  });
});
