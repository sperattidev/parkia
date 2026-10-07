import type { MultiPoligono, ZonasGeoJson } from '@parkia/contracts';
import { describe, expect, it } from 'vitest';

import { limites, puntoEnMultiPoligono, zonaEnUbicacion } from '@/lib/geo';

// Cuadrado de 0 a 10 con un hueco de 4 a 6.
const conHueco: MultiPoligono = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ],
  ],
};

const microcentro: ZonasGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: '89b759a9-c6c1-4f0b-9597-e7d26813566b',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-61.4905, -33.457],
              [-61.4845, -33.457],
              [-61.4845, -33.463],
              [-61.4905, -33.463],
              [-61.4905, -33.457],
            ],
          ],
        ],
      },
      properties: { nombre: 'Microcentro', color: '#2563EB', enHorarioDeCobro: true },
    },
  ],
};

describe('geo', () => {
  it('detecta puntos dentro y fuera, respetando huecos', () => {
    expect(puntoEnMultiPoligono([2, 2], conHueco)).toBe(true);
    expect(puntoEnMultiPoligono([5, 5], conHueco)).toBe(false);
    expect(puntoEnMultiPoligono([12, 5], conHueco)).toBe(false);
  });

  it('encuentra la zona de una ubicación', () => {
    expect(zonaEnUbicacion(microcentro, { lat: -33.46, lng: -61.4875 })?.properties.nombre).toBe(
      'Microcentro',
    );
    expect(zonaEnUbicacion(microcentro, { lat: -33.48, lng: -61.5 })).toBeUndefined();
  });

  it('calcula el recuadro de las zonas', () => {
    expect(limites(microcentro)).toEqual([
      [-61.4905, -33.463],
      [-61.4845, -33.457],
    ]);
    expect(limites({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});
