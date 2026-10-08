'use client';

import type { Mapa, MunicipioPublico } from '@parkia/contracts';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

export interface Posicion {
  readonly lat: number;
  readonly lng: number;
  /** Radio de error informado por el dispositivo, en metros. */
  readonly precision: number;
}

type EstadoDelGps = 'buscando' | 'activo' | 'denegado' | 'no_disponible';

interface Ronda {
  readonly municipio: MunicipioPublico;
  readonly mapa: Mapa;
  readonly posicion: Posicion | undefined;
  readonly gps: EstadoDelGps;
}

const RondaContext = createContext<Ronda | null>(null);

/**
 * Estado compartido por las pantallas del agente: municipio, cuadras y la
 * posición GPS, que se sigue mientras la app está abierta (un solo watcher
 * para todas las pestañas).
 */
export function ProveedorDeRonda({
  municipio,
  mapa,
  children,
}: {
  municipio: MunicipioPublico;
  mapa: Mapa;
  children: ReactNode;
}) {
  const [posicion, setPosicion] = useState<Posicion>();
  const [gps, setGps] = useState<EstadoDelGps>('buscando');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      // El navegador no ofrece GPS: se informa una sola vez al montar.
      queueMicrotask(() => {
        setGps('no_disponible');
      });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosicion({ lat: coords.latitude, lng: coords.longitude, precision: coords.accuracy });
        setGps('activo');
      },
      (error) => {
        setGps(error.code === error.PERMISSION_DENIED ? 'denegado' : 'no_disponible');
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, []);

  return <RondaContext value={{ municipio, mapa, posicion, gps }}>{children}</RondaContext>;
}

export function useRonda(): Ronda {
  const ronda = use(RondaContext);
  if (!ronda) throw new Error('useRonda debe usarse dentro de ProveedorDeRonda.');
  return ronda;
}
