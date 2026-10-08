'use client';

import type { ExpressionSpecification, GeoJSONSource, Map as MapaMapLibre } from 'maplibre-gl';
import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

import { limites, rotulosDeZonas, type CuadrasDibujables as MapaDeCuadras } from '@/lib/geo';

const ESTILOS = {
  claro: process.env.NEXT_PUBLIC_ESTILO_MAPA ?? 'https://tiles.openfreemap.org/styles/positron',
  oscuro: process.env.NEXT_PUBLIC_ESTILO_MAPA_OSCURO ?? 'https://tiles.openfreemap.org/styles/dark',
};

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';
const CONSULTA_ESCRITORIO = '(min-width: 1024px)';

function suscribirTema(aviso: () => void) {
  const consulta = window.matchMedia(CONSULTA_OSCURO);
  consulta.addEventListener('change', aviso);
  return () => {
    consulta.removeEventListener('change', aviso);
  };
}

function useTemaOscuro(): boolean {
  return useSyncExternalStore(
    suscribirTema,
    () => window.matchMedia(CONSULTA_OSCURO).matches,
    () => false,
  );
}

/** Espacio que ocupan la hoja inferior (celular) o el panel lateral (escritorio). */
function margenes(conHoja: boolean) {
  if (!conHoja) return { top: 40, bottom: 40, left: 40, right: 40 };
  return window.matchMedia(CONSULTA_ESCRITORIO).matches
    ? { top: 64, bottom: 64, left: 480, right: 64 }
    : { top: 96, bottom: 380, left: 32, right: 32 };
}

export interface Ubicacion {
  readonly lat: number;
  readonly lng: number;
}

const HALO = { claro: '#ffffff', oscuro: '#0a1020' };

const seleccionada: ExpressionSpecification = ['boolean', ['feature-state', 'seleccionada'], false];
const atenuada: ExpressionSpecification = ['boolean', ['feature-state', 'atenuada'], false];

/** Punto destacado sobre el mapa (por ejemplo, un vehículo vencido en el radar del agente). */
export interface Aviso {
  readonly id: string;
  /** `[lng, lat]` */
  readonly posicion: readonly [number, number];
  readonly tono: 'peligro' | 'alerta';
}

const TONOS_DE_AVISO = { peligro: '#e02d3c', alerta: '#f59e0b' } as const;

function datosDeAvisos(avisos: readonly Aviso[]) {
  return {
    type: 'FeatureCollection' as const,
    features: avisos.map((aviso) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [...aviso.posicion] },
      properties: { id: aviso.id, color: TONOS_DE_AVISO[aviso.tono] },
    })),
  };
}

/**
 * Grosor según el zoom (finita de lejos, ancha como la calzada de cerca) y,
 * opcionalmente, según esté seleccionada. MapLibre exige que `zoom` quede en
 * la interpolación de primer nivel.
 */
function grosor(
  [lejos, cerca]: readonly [number, number],
  [lejosElegida, cercaElegida]: readonly [number, number] = [lejos, cerca],
): ExpressionSpecification {
  return [
    'interpolate',
    ['exponential', 1.6],
    ['zoom'],
    13,
    ['case', seleccionada, lejosElegida, lejos],
    18,
    ['case', seleccionada, cercaElegida, cerca],
  ];
}

/**
 * MapLibre solo admite ids numéricos en el estado de las geometrías: se
 * promueve el uuid desde las propiedades.
 */
function datosDeCuadras(datos: MapaDeCuadras) {
  return {
    ...datos.cuadras,
    features: datos.cuadras.features.map((cuadra) => ({
      ...cuadra,
      properties: { ...cuadra.properties, id: cuadra.id },
    })),
  };
}

function agregarCuadras(mapa: MapaMapLibre, datos: MapaDeCuadras, oscuro: boolean) {
  if (mapa.getSource('cuadras')) return;
  const halo = oscuro ? HALO.oscuro : HALO.claro;
  mapa.addSource('cuadras', { type: 'geojson', data: datosDeCuadras(datos), promoteId: 'id' });
  mapa.addSource('zonas-rotulos', { type: 'geojson', data: rotulosDeZonas(datos) });

  const linea = { 'line-cap': 'round', 'line-join': 'round' } as const;
  mapa.addLayer({
    id: 'cuadras-halo',
    type: 'line',
    source: 'cuadras',
    layout: linea,
    paint: {
      'line-color': ['case', seleccionada, ['get', 'color'], halo],
      'line-width': grosor([5, 18], [10, 30]),
      'line-opacity': ['case', seleccionada, 0.3, 0.95],
    },
  });
  mapa.addLayer({
    id: 'cuadras-linea',
    type: 'line',
    source: 'cuadras',
    layout: linea,
    paint: {
      // Un color propio por cuadra (por ejemplo, según su ocupación) prevalece sobre el de la zona.
      'line-color': ['coalesce', ['feature-state', 'color'], ['get', 'color']],
      'line-width': grosor([2.5, 10], [5, 16]),
      'line-opacity': ['case', seleccionada, 1, atenuada, 0.3, oscuro ? 0.85 : 0.75],
    },
  });
  // Área de toque generosa e invisible: un dedo no acierta a una línea de 3 px.
  mapa.addLayer({
    id: 'cuadras-toque',
    type: 'line',
    source: 'cuadras',
    paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': grosor([18, 36]) },
  });
  mapa.addLayer({
    id: 'cuadras-calle',
    type: 'symbol',
    source: 'cuadras',
    minzoom: 15.5,
    layout: {
      'symbol-placement': 'line-center',
      'text-field': ['get', 'calle'],
      'text-size': 11,
      'text-font': ['Noto Sans Bold'],
      'text-max-angle': 30,
    },
    paint: {
      'text-color': oscuro ? '#e6ebf5' : '#1d2433',
      'text-halo-color': halo,
      'text-halo-width': 1.6,
    },
  });
  mapa.addSource('avisos', { type: 'geojson', data: datosDeAvisos([]) });
  mapa.addLayer({
    id: 'avisos-halo',
    type: 'circle',
    source: 'avisos',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.25,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 18, 18],
    },
  });
  mapa.addLayer({
    id: 'avisos-punto',
    type: 'circle',
    source: 'avisos',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 18, 8],
      'circle-stroke-color': halo,
      'circle-stroke-width': 2,
    },
  });
  mapa.addLayer({
    id: 'zonas-nombre',
    type: 'symbol',
    source: 'zonas-rotulos',
    maxzoom: 16,
    layout: {
      'text-field': ['upcase', ['get', 'nombre']],
      'text-size': 12,
      'text-letter-spacing': 0.12,
      'text-font': ['Noto Sans Bold'],
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': halo,
      'text-halo-width': 2,
    },
  });
}

/**
 * Mapa con las cuadras tarifadas (coloreadas por zona) y la ubicación del
 * usuario; tocar una cuadra la elige. MapLibre se carga
 * solo en el navegador (necesita WebGL) y en su propio fragmento de código.
 */
export function Mapa({
  mapa,
  cuadraSeleccionada,
  atenuadas,
  colores,
  avisos,
  conHoja = true,
  geolocalizarAlAbrir = true,
  alUbicar,
  alTocarCuadra,
  className,
}: {
  mapa: MapaDeCuadras;
  cuadraSeleccionada?: string | undefined;
  /** Cuadras que se dibujan tenues (por ejemplo, las que nadie controló hoy). */
  atenuadas?: ReadonlySet<string> | undefined;
  avisos?: readonly Aviso[] | undefined;
  /** Color por cuadra que reemplaza al de su zona. */
  colores?: ReadonlyMap<string, string> | undefined;
  /** Deja lugar para la hoja inferior (celular) o el panel lateral (escritorio) al encuadrar. */
  conHoja?: boolean;
  /** Pide la ubicación al abrir (conductor y agente; no en el panel municipal). */
  geolocalizarAlAbrir?: boolean;
  alUbicar?: (ubicacion: Ubicacion) => void;
  alTocarCuadra?: (cuadraId: string) => void;
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaMapLibre | null>(null);
  const oscuro = useTemaOscuro();
  const notificarUbicacion = useEffectEvent((ubicacion: Ubicacion) => alUbicar?.(ubicacion));
  const notificarToque = useEffectEvent((cuadraId: string) => alTocarCuadra?.(cuadraId));
  // El mapa se crea una vez por tema; los datos nuevos (ocupación) se aplican en el lugar.
  const datosActuales = useEffectEvent(() => mapa);
  const opciones = useEffectEvent(() => ({ conHoja, geolocalizarAlAbrir }));
  const marcarSeleccion = useEffectEvent((instancia: MapaMapLibre) => {
    for (const cuadra of mapa.cuadras.features) {
      instancia.setFeatureState(
        { source: 'cuadras', id: cuadra.id },
        {
          seleccionada: cuadra.id === cuadraSeleccionada,
          atenuada: atenuadas?.has(cuadra.id) ?? false,
          color: colores?.get(cuadra.id) ?? null,
        },
      );
    }
    void instancia.getSource<GeoJSONSource>('avisos')?.setData(datosDeAvisos(avisos ?? []));
  });

  useEffect(() => {
    let cancelado = false;

    void import('maplibre-gl').then((maplibre) => {
      const { Map, GeolocateControl, NavigationControl } = maplibre;
      if (cancelado || !contenedorRef.current) return;
      // Worker copiado a public/vendor (ver scripts/copiar-worker-mapa.mjs).
      maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);

      const recuadro = limites(datosActuales());
      const instancia = new Map({
        container: contenedorRef.current,
        style: oscuro ? ESTILOS.oscuro : ESTILOS.claro,
        ...(recuadro
          ? {
              bounds: recuadro,
              fitBoundsOptions: { padding: margenes(opciones().conHoja), maxZoom: 16.5 },
            }
          : { center: [-61.4875, -33.46], zoom: 14 }),
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      mapaRef.current = instancia;

      instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      const geolocalizar = new GeolocateControl({
        positionOptions: { enableHighAccuracy: true, timeout: 10_000 },
        trackUserLocation: true,
        fitBoundsOptions: { maxZoom: 17 },
      });
      instancia.addControl(geolocalizar, 'top-right');
      geolocalizar.on('geolocate', (posicion) => {
        notificarUbicacion({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
      });

      // Se ejecuta en cada carga de estilo (también al cambiar de tema).
      instancia.on('style.load', () => {
        agregarCuadras(instancia, datosActuales(), oscuro);
        marcarSeleccion(instancia);
      });
      instancia.on('click', 'cuadras-toque', (evento) => {
        const id = evento.features?.[0]?.properties.id as unknown;
        if (typeof id === 'string') notificarToque(id);
      });
      instancia.on('mouseenter', 'cuadras-toque', () => {
        instancia.getCanvas().style.cursor = 'pointer';
      });
      instancia.on('mouseleave', 'cuadras-toque', () => {
        instancia.getCanvas().style.cursor = '';
      });
      instancia.once('load', () => {
        // Pide la ubicación al abrir: es lo primero que se necesita para estacionar o controlar.
        if (opciones().geolocalizarAlAbrir) geolocalizar.trigger();
      });
    });

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [oscuro]);

  useEffect(() => {
    const fuente = mapaRef.current?.getSource<GeoJSONSource>('cuadras');
    if (!fuente || !mapaRef.current) return;
    void fuente.setData(datosDeCuadras(mapa));
    marcarSeleccion(mapaRef.current);
  }, [mapa]);

  useEffect(() => {
    const instancia = mapaRef.current;
    // No se usa isStyleLoaded(): da falso mientras cargan las teselas del fondo.
    if (instancia?.getSource('cuadras')) marcarSeleccion(instancia);
  }, [cuadraSeleccionada, atenuadas, avisos, colores]);

  return (
    <div
      ref={contenedorRef}
      role="region"
      aria-label="Mapa de cuadras con estacionamiento medido"
      className={className}
    />
  );
}
