import { describe, expect, it } from 'vitest';

import {
  coincidencia,
  evaluarControl,
  inicioDelDia,
  situacion,
  type SituacionDeControl,
} from '../src/control.js';

const ahora = new Date('2026-10-05T13:00:00Z');
const enUnaHora = new Date('2026-10-05T14:00:00Z');

const base: SituacionDeControl = {
  zonaId: 'centro',
  enHorarioDeCobro: true,
  cercanas: [{ id: 'sarmiento-700', zonaId: 'centro' }],
  estacionamiento: { zonaId: 'centro', cuadraId: 'sarmiento-700', venceEn: enUnaHora },
  ahora,
};

describe('evaluarControl', () => {
  it('habilita un estacionamiento vigente en la zona', () => {
    expect(evaluarControl(base)).toBe('habilitado');
  });

  it('fuera de las cuadras pagas no evalúa nada más', () => {
    expect(evaluarControl({ ...base, zonaId: null, estacionamiento: null })).toBe('fuera_de_zona');
  });

  it('fuera del horario de cobro todos están habilitados', () => {
    expect(evaluarControl({ ...base, enHorarioDeCobro: false, estacionamiento: null })).toBe(
      'fuera_de_horario',
    );
  });

  it('sin estacionamiento en la jornada', () => {
    expect(evaluarControl({ ...base, estacionamiento: null })).toBe('sin_estacionamiento');
  });

  it('vencido al llegar al vencimiento', () => {
    const estacionamiento = { zonaId: 'centro', cuadraId: null, venceEn: ahora };
    expect(evaluarControl({ ...base, estacionamiento })).toBe('vencido');
  });

  it('otra zona si pagó en una zona que no está cerca', () => {
    const estacionamiento = { zonaId: 'quemada', cuadraId: null, venceEn: enUnaHora };
    expect(evaluarControl({ ...base, estacionamiento })).toBe('otra_zona');
  });

  it('en una esquina entre zonas acepta la zona de una cuadra cercana', () => {
    const esquina: SituacionDeControl = {
      ...base,
      zonaId: 'quemada',
      cercanas: [
        { id: 'casado-900', zonaId: 'quemada' },
        { id: 'sarmiento-700', zonaId: 'centro' },
      ],
    };
    expect(evaluarControl(esquina)).toBe('habilitado');
  });
});

describe('coincidencia', () => {
  const cercanas = [
    { id: 'a', zonaId: 'z' },
    { id: 'b', zonaId: 'z' },
  ];

  it('distingue misma cuadra, cercana y otra', () => {
    expect(coincidencia('a', 'a', cercanas)).toBe('misma_cuadra');
    expect(coincidencia('b', 'a', cercanas)).toBe('cuadra_cercana');
    expect(coincidencia('c', 'a', cercanas)).toBe('otra_cuadra');
  });

  it('es nula si falta alguna de las dos cuadras', () => {
    expect(coincidencia(null, 'a', cercanas)).toBeNull();
    expect(coincidencia('a', null, cercanas)).toBeNull();
  });
});

describe('situacion', () => {
  it('vigente, por vencer y vencido', () => {
    expect(situacion(enUnaHora, ahora)).toBe('vigente');
    expect(situacion(new Date('2026-10-05T13:09:59Z'), ahora)).toBe('por_vencer');
    expect(situacion(ahora, ahora)).toBe('vencido');
  });
});

describe('inicioDelDia', () => {
  it('es la medianoche local, no la de UTC', () => {
    // 01:30 UTC del 6/10 son las 22:30 del 5/10 en Argentina.
    const instante = new Date('2026-10-06T01:30:00Z');
    expect(inicioDelDia(instante, 'America/Argentina/Buenos_Aires').toISOString()).toBe(
      '2026-10-05T03:00:00.000Z',
    );
  });
});
