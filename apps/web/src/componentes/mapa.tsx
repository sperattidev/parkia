'use client';

import type { ZonasGeoJson } from '@parkia/contracts';
import type { Map as MapaMapLibre } from 'maplibre-gl';
import { useEffect, useEffectEvent, useRef } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

import { limites } from '@/lib/geo';

const ESTILO =
  process.env.NEXT_PUBLIC_ESTILO_MAPA ?? 'https://tiles.openfreemap.org/styles/liberty';

export interface Ubicacion {
  readonly lat: number;
  readonly lng: number;
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
  const notificarUbicacion = useEffectEvent((ubicacion: Ubicacion) => alUbicar?.(ubicacion));

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
        style: ESTILO,
        ...(recuadro
          ? { bounds: recuadro, fitBoundsOptions: { padding: 48, maxZoom: 16 } }
          : { center: [-61.4875, -33.46], zoom: 14 }),
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
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

      instancia.on('load', () => {
        // MapLibre solo admite ids numéricos en el estado de las geometrías: se
        // promueve el uuid desde las propiedades.
        instancia.addSource('zonas', {
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
        instancia.addLayer({
          id: 'zonas-relleno',
          type: 'fill',
          source: 'zonas',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'seleccionada'], false],
              0.28,
              0.16,
            ],
          },
        });
        instancia.addLayer({
          id: 'zonas-borde',
          type: 'line',
          source: 'zonas',
          paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [2, 1] },
        });
        instancia.addLayer({
          id: 'zonas-nombre',
          type: 'symbol',
          source: 'zonas',
          layout: {
            'text-field': ['get', 'nombre'],
            'text-size': 14,
            'text-font': ['Noto Sans Bold'],
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        });
        // Pide la ubicación al cargar: es lo que el conductor necesita para estacionar.
        geolocalizar.trigger();
      });
    });

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [zonas]);

  useEffect(() => {
    const instancia = mapaRef.current;
    if (!instancia?.isStyleLoaded()) return;
    for (const zona of zonas.features) {
      instancia.setFeatureState(
        { source: 'zonas', id: zona.id },
        { seleccionada: zona.id === zonaSeleccionada },
      );
    }
  }, [zonas, zonaSeleccionada]);

  return (
    <div
      ref={contenedorRef}
      role="region"
      aria-label="Mapa de zonas de estacionamiento medido"
      className={className}
    />
  );
}
