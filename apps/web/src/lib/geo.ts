type Posicion = readonly [number, number];

/**
 * Lo mínimo para dibujar cuadras: lo cumplen el mapa público (`Mapa`) y el
 * de gestión, que incluye cuadras sin zona.
 */
export interface CuadrasDibujables {
  readonly zonas: readonly {
    readonly id: string;
    readonly nombre: string;
    readonly color: string;
  }[];
  readonly cuadras: {
    readonly type: 'FeatureCollection';
    readonly features: readonly {
      readonly type: 'Feature';
      readonly id: string;
      readonly geometry: { readonly type: 'LineString'; readonly coordinates: readonly Posicion[] };
      readonly properties: {
        readonly zonaId: string | null;
        readonly calle: string;
        readonly color: string;
      };
    }[];
  };
}

/** Rectángulo que contiene todas las cuadras: `[[oeste, sur], [este, norte]]`. */
export function limites(mapa: CuadrasDibujables): [[number, number], [number, number]] | null {
  const puntos = mapa.cuadras.features.flatMap((cuadra) => cuadra.geometry.coordinates);
  if (puntos.length === 0) return null;
  const lngs = puntos.map(([lng]) => lng);
  const lats = puntos.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** Punto medio (por recorrido) de una línea. */
export function puntoMedio(linea: readonly Posicion[]): [number, number] {
  const tramos = linea.slice(1).map((fin, i) => {
    const inicio = linea[i] ?? fin;
    return { inicio, fin, largo: Math.hypot(fin[0] - inicio[0], fin[1] - inicio[1]) };
  });
  let resto = tramos.reduce((total, tramo) => total + tramo.largo, 0) / 2;
  for (const { inicio, fin, largo } of tramos) {
    if (resto <= largo && largo > 0) {
      const t = resto / largo;
      return [inicio[0] + (fin[0] - inicio[0]) * t, inicio[1] + (fin[1] - inicio[1]) * t];
    }
    resto -= largo;
  }
  const [primero] = linea;
  return primero ? [primero[0], primero[1]] : [0, 0];
}

/** Un punto por zona, en el centro de sus cuadras, para rotular el mapa. */
export function rotulosDeZonas(mapa: CuadrasDibujables) {
  return {
    type: 'FeatureCollection' as const,
    features: mapa.zonas.flatMap((zona) => {
      const medios = mapa.cuadras.features
        .filter((cuadra) => cuadra.properties.zonaId === zona.id)
        .map((cuadra) => puntoMedio(cuadra.geometry.coordinates));
      if (medios.length === 0) return [];
      const promedio = (eje: 0 | 1) =>
        medios.reduce((total, punto) => total + punto[eje], 0) / medios.length;
      return [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [promedio(0), promedio(1)] },
          properties: { nombre: zona.nombre, color: zona.color },
        },
      ];
    }),
  };
}
