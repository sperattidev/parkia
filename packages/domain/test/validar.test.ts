import { describe, expect, it } from 'vitest';

import { pesos, validarReglaTarifaria, type ReglaTarifaria } from '../src/index.js';
import { reglaMicrocentro as regla } from './fixtures.js';

function codigoDeError(cambios: Partial<Record<keyof ReglaTarifaria, unknown>>): string | null {
  try {
    validarReglaTarifaria({ ...regla, ...cambios } as ReglaTarifaria);
    return null;
  } catch (error) {
    return (error as { codigo?: string }).codigo ?? 'SIN_CODIGO';
  }
}

describe('validarReglaTarifaria', () => {
  it('acepta una regla válida', () => {
    expect(() => {
      validarReglaTarifaria(regla);
    }).not.toThrow();
  });

  it.each<[string, Partial<Record<keyof ReglaTarifaria, unknown>>, string]>([
    ['zona horaria desconocida', { zonaHoraria: 'Marte/Olympus' }, 'ZONA_HORARIA_INVALIDA'],
    ['fracción cero', { fraccionMinutos: 0 }, 'FRACCION_INVALIDA'],
    ['fracción decimal', { fraccionMinutos: 7.5 }, 'FRACCION_INVALIDA'],
    ['mínimo no múltiplo de la fracción', { minimoMinutos: 20 }, 'MINIMO_INVALIDO'],
    ['tolerancia negativa', { toleranciaMinutos: -1 }, 'TOLERANCIA_INVALIDA'],
    ['tope cero', { topePorJornada: 0 }, 'TOPE_INVALIDO'],
    ['sin tramos', { tramos: [] }, 'TRAMOS_VACIOS'],
    [
      'primer tramo distinto de 0',
      { tramos: [{ desdeMinuto: 15, precioHora: pesos(1000) }] },
      'TRAMOS_INVALIDOS',
    ],
    [
      'tramos desordenados',
      {
        tramos: [
          { desdeMinuto: 0, precioHora: pesos(1000) },
          { desdeMinuto: 120, precioHora: pesos(1500) },
          { desdeMinuto: 60, precioHora: pesos(1650) },
        ],
      },
      'TRAMOS_INVALIDOS',
    ],
    [
      'tramo fuera de la fracción',
      {
        tramos: [
          { desdeMinuto: 0, precioHora: pesos(1000) },
          { desdeMinuto: 50, precioHora: pesos(1500) },
        ],
      },
      'TRAMOS_INVALIDOS',
    ],
    ['precio negativo', { tramos: [{ desdeMinuto: 0, precioHora: -100 }] }, 'TRAMOS_INVALIDOS'],
    [
      'franja sin días',
      { horario: [{ dias: [], desde: '08:00', hasta: '20:00' }] },
      'DIAS_INVALIDOS',
    ],
    [
      'día inexistente',
      { horario: [{ dias: [7], desde: '08:00', hasta: '20:00' }] },
      'DIAS_INVALIDOS',
    ],
    [
      'franja invertida',
      { horario: [{ dias: [1], desde: '20:00', hasta: '08:00' }] },
      'FRANJA_INVALIDA',
    ],
    [
      'hora mal formada',
      { horario: [{ dias: [1], desde: '8:00', hasta: '20:00' }] },
      'HORA_INVALIDA',
    ],
    [
      'minutos inexistentes',
      { horario: [{ dias: [1], desde: '08:60', hasta: '20:00' }] },
      'HORA_INVALIDA',
    ],
    [
      'después de las 24:00',
      { horario: [{ dias: [1], desde: '08:00', hasta: '24:01' }] },
      'HORA_INVALIDA',
    ],
    [
      'franjas superpuestas',
      {
        horario: [
          { dias: [1, 2], desde: '08:00', hasta: '13:00' },
          { dias: [2], desde: '12:00', hasta: '20:00' },
        ],
      },
      'FRANJAS_SUPERPUESTAS',
    ],
    [
      'fecha especial inexistente',
      { diasEspeciales: [{ fecha: '2026-02-30', franjas: [] }] },
      'FECHA_INVALIDA',
    ],
    [
      'fecha especial mal formada',
      { diasEspeciales: [{ fecha: '12/10/2026', franjas: [] }] },
      'FECHA_INVALIDA',
    ],
    [
      'fecha especial repetida',
      {
        diasEspeciales: [
          { fecha: '2026-10-12', franjas: [] },
          { fecha: '2026-10-12', franjas: [] },
        ],
      },
      'DIA_ESPECIAL_DUPLICADO',
    ],
    [
      'franjas superpuestas en día especial',
      {
        diasEspeciales: [
          {
            fecha: '2026-10-12',
            franjas: [
              { desde: '08:00', hasta: '12:00' },
              { desde: '11:00', hasta: '14:00' },
            ],
          },
        ],
      },
      'FRANJAS_SUPERPUESTAS',
    ],
  ])('rechaza %s', (_caso, cambios, codigo) => {
    expect(codigoDeError(cambios)).toBe(codigo);
  });

  it('acepta franjas contiguas', () => {
    expect(
      codigoDeError({
        horario: [
          { dias: [1], desde: '08:00', hasta: '13:00' },
          { dias: [1], desde: '13:00', hasta: '20:00' },
        ],
      }),
    ).toBeNull();
  });

  it('acepta una regla sin tope ni días especiales', () => {
    const { topePorJornada: _tope, diasEspeciales: _especiales, ...minima } = regla;
    expect(() => {
      validarReglaTarifaria(minima);
    }).not.toThrow();
  });
});
