import type { MultiPoligono, ZonasGeoJson } from '@parkia/contracts';

type Anillo = readonly (readonly [number, number])[];

/** Punto dentro de un anillo (ray casting). Coordenadas `[lng, lat]`. */
function dentroDelAnillo([x, y]: readonly [number, number], anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i] ?? [0, 0];
    const [xj, yj] = anillo[j] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Punto dentro de un multipolígono GeoJSON (respeta huecos). */
export function puntoEnMultiPoligono(
  punto: readonly [number, number],
  area: MultiPoligono,
): boolean {
  return area.coordinates.some(([exterior, ...huecos]) => {
    if (!exterior || !dentroDelAnillo(punto, exterior)) return false;
    return !huecos.some((hueco) => dentroDelAnillo(punto, hueco));
  });
}

/** Zona que contiene la ubicación, si hay alguna. */
export function zonaEnUbicacion(
  zonas: ZonasGeoJson,
  ubicacion: { lat: number; lng: number },
): ZonasGeoJson['features'][number] | undefined {
  return zonas.features.find((zona) =>
    puntoEnMultiPoligono([ubicacion.lng, ubicacion.lat], zona.geometry),
  );
}

/** Rectángulo que contiene todas las zonas: `[[oeste, sur], [este, norte]]`. */
export function limites(zonas: ZonasGeoJson): [[number, number], [number, number]] | null {
  const puntos = zonas.features.flatMap((zona) => zona.geometry.coordinates.flat(2));
  if (puntos.length === 0) return null;
  const lngs = puntos.map(([lng]) => lng);
  const lats = puntos.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
