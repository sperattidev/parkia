'use client';

import type { ZonasGeoJson } from '@parkia/contracts';
import type { ExpressionSpecification, Map as MapaMapLibre } from 'maplibre-gl';
import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

import { limites } from '@/lib/geo';

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
function margenes() {
  return window.matchMedia(CONSULTA_ESCRITORIO).matches
    ? { top: 64, bottom: 64, left: 480, right: 64 }
    : { top: 96, bottom: 380, left: 32, right: 32 };
}

export interface Ubicacion {
  readonly lat: number;
  readonly lng: number;
}

function agregarZonas(mapa: MapaMapLibre, zonas: ZonasGeoJson, oscuro: boolean) {
  if (mapa.getSource('zonas')) return;
  // MapLibre solo admite ids numéricos en el estado de las geometrías: se
  // promueve el uuid desde las propiedades.
  mapa.addSource('zonas', {
    type: 'geojson',
    data: {
      ...zonas,
      features: zonas.features.map((zona) => ({
        ...zona,
        properties: { ...zona.properties, id: zona.id },
      })),
    },
    promoteId: 'id',
  });
  const seleccionada: ExpressionSpecification = [
    'boolean',
    ['feature-state', 'seleccionada'],
    false,
  ];
  mapa.addLayer({
    id: 'zonas-relleno',
    type: 'fill',
    source: 'zonas',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': ['case', seleccionada, oscuro ? 0.32 : 0.2, oscuro ? 0.2 : 0.12],
    },
  });
  mapa.addLayer({
    id: 'zonas-halo',
    type: 'line',
    source: 'zonas',
    paint: { 'line-color': oscuro ? '#0a1020' : '#ffffff', 'line-width': 6, 'line-opacity': 0.9 },
  });
  mapa.addLayer({
    id: 'zonas-borde',
    type: 'line',
    source: 'zonas',
    paint: { 'line-color': ['get', 'color'], 'line-width': ['case', seleccionada, 3, 2.25] },
  });
  mapa.addLayer({
    id: 'zonas-nombre',
    type: 'symbol',
    source: 'zonas',
    layout: {
      'text-field': ['upcase', ['get', 'nombre']],
      'text-size': 12,
      'text-letter-spacing': 0.12,
      'text-font': ['Noto Sans Bold'],
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': oscuro ? '#0a1020' : '#ffffff',
      'text-halo-width': 2,
    },
  });
}

/**
 * Mapa con las zonas tarifadas y la ubicación del usuario. MapLibre se carga
 * solo en el navegador (necesita WebGL) y en su propio fragmento de código.
 */
export function Mapa({
  zonas,
  zonaSeleccionada,
  alUbicar,
  className,
}: {
  zonas: ZonasGeoJson;
  zonaSeleccionada?: string | undefined;
  alUbicar?: (ubicacion: Ubicacion) => void;
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaMapLibre | null>(null);
  const oscuro = useTemaOscuro();
  const notificarUbicacion = useEffectEvent((ubicacion: Ubicacion) => alUbicar?.(ubicacion));
  const marcarSeleccion = useEffectEvent((mapa: MapaMapLibre) => {
    for (const zona of zonas.features) {
      mapa.setFeatureState(
        { source: 'zonas', id: zona.id },
        { seleccionada: zona.id === zonaSeleccionada },
      );
    }
  });

  useEffect(() => {
    let cancelado = false;

    void import('maplibre-gl').then((maplibre) => {
      const { Map, GeolocateControl, NavigationControl } = maplibre;
      if (cancelado || !contenedorRef.current) return;
      // Worker copiado a public/vendor (ver scripts/copiar-worker-mapa.mjs).
      maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);

      const recuadro = limites(zonas);
      const instancia = new Map({
        container: contenedorRef.current,
        style: oscuro ? ESTILOS.oscuro : ESTILOS.claro,
        ...(recuadro
          ? { bounds: recuadro, fitBoundsOptions: { padding: margenes(), maxZoom: 16.5 } }
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
        agregarZonas(instancia, zonas, oscuro);
        marcarSeleccion(instancia);
      });
      instancia.once('load', () => {
        // Pide la ubicación al abrir: es lo que el conductor necesita para estacionar.
        geolocalizar.trigger();
      });
    });

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [zonas, oscuro]);

  useEffect(() => {
    const instancia = mapaRef.current;
    if (instancia?.isStyleLoaded()) marcarSeleccion(instancia);
  }, [zonaSeleccionada]);

  return (
    <div
      ref={contenedorRef}
      role="region"
      aria-label="Mapa de zonas de estacionamiento medido"
      className={className}
    />
  );
}
