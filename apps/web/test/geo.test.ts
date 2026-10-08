import type { CuadraDelMapa, Mapa, ZonaResumen } from '@parkia/contracts';
import { describe, expect, it } from 'vitest';

import { limites, puntoMedio, rotulosDeZonas } from '@/lib/geo';

const zona: ZonaResumen = {
  id: '00000000-0000-4000-8000-000000000001',
  nombre: 'Microcentro',
  color: '#2754E6',
  enHorarioDeCobro: true,
  tarifa: { precioHora: 100_000, horario: 'Lun a Vie 8 a 20' },
};

function cuadra(id: string, coordinates: [number, number][]): CuadraDelMapa {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'LineString', coordinates },
    properties: {
      zonaId: zona.id,
      calle: 'Sarmiento',
      alturaDesde: 700,
      alturaHasta: 799,
      lugaresNumerados: false,
      lugares: { par: 18, impar: 18 },
      ocupados: { par: 0, impar: 0 },
      color: zona.color,
    },
  };
}

// Dos cuadras que forman una "L": de (0,0) a (2,0) y de (2,0) a (2,4).
const mapa: Mapa = {
  zonas: [zona, { ...zona, id: '00000000-0000-4000-8000-000000000002', nombre: 'Sin cuadras' }],
  cuadras: {
    type: 'FeatureCollection',
    features: [
      cuadra('00000000-0000-4000-8000-00000000000a', [
        [0, 0],
        [2, 0],
      ]),
      cuadra('00000000-0000-4000-8000-00000000000b', [
        [2, 0],
        [2, 4],
      ]),
    ],
  },
};

describe('limites', () => {
  it('abarca todas las cuadras', () => {
    expect(limites(mapa)).toEqual([
      [0, 0],
      [2, 4],
    ]);
  });

  it('es nulo sin cuadras', () => {
    expect(limites({ ...mapa, cuadras: { type: 'FeatureCollection', features: [] } })).toBeNull();
  });
});

describe('puntoMedio', () => {
  it('recorre la línea, no promedia vértices', () => {
    expect(
      puntoMedio([
        [0, 0],
        [1, 0],
        [1, 3],
      ]),
    ).toEqual([1, 1]);
  });

  it('tolera una línea degenerada', () => {
    expect(
      puntoMedio([
        [5, 5],
        [5, 5],
      ]),
    ).toEqual([5, 5]);
  });
});

describe('rotulosDeZonas', () => {
  it('ubica cada zona en el centro de sus cuadras y omite las vacías', () => {
    const { features } = rotulosDeZonas(mapa);
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({
      geometry: { coordinates: [1.5, 1] },
      properties: { nombre: 'Microcentro', color: '#2754E6' },
    });
  });
});
