'use client';

import type {
  Billetera,
  Estacionamiento,
  LugaresDeMano,
  UbicacionEnCuadra,
  Vehiculo,
} from '@parkia/contracts';
import type { Lado } from '@parkia/domain';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api, ErrorDeParkia } from './cliente';

/** Hora actual que se actualiza periódicamente (para contadores y vencimientos). */
export function useAhora(intervaloMs = 15_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      setAhora(new Date());
    }, intervaloMs);
    return () => {
      clearInterval(id);
    };
  }, [intervaloMs]);
  return ahora;
}

export const claves = {
  activo: (municipio: string) => ['estacionamiento-activo', municipio] as const,
  historial: (municipio: string) => ['historial', municipio] as const,
  billetera: (municipio: string) => ['billetera', municipio] as const,
  vehiculos: ['vehiculos'] as const,
  lugares: (municipio: string, cuadraId: string, lado: Lado) =>
    ['lugares', municipio, cuadraId, lado] as const,
};

/**
 * Cuadra, mano y altura donde está el conductor. `null` si no está sobre una
 * cuadra paga. Se redondea a ~1 m para no repetir consultas por el ruido del GPS.
 */
export function useUbicacionEnCuadra(
  municipio: string,
  ubicacion: { lat: number; lng: number } | undefined,
) {
  const lat = ubicacion?.lat.toFixed(5);
  const lng = ubicacion?.lng.toFixed(5);
  return useQuery({
    queryKey: ['ubicar', municipio, lat, lng],
    queryFn: async () => {
      try {
        return await api<UbicacionEnCuadra>(
          `municipios/${municipio}/ubicar?lat=${lat ?? ''}&lng=${lng ?? ''}`,
        );
      } catch (error) {
        if (error instanceof ErrorDeParkia && error.codigo === 'FUERA_DE_ZONA') return null;
        throw error;
      }
    },
    enabled: lat !== undefined && lng !== undefined,
    staleTime: 60_000,
    placeholderData: (anterior) => anterior,
  });
}

/** Lugares ocupados de una mano (solo cuadras con lugares numerados). */
export function useLugaresDeMano(
  municipio: string,
  cuadraId: string | undefined,
  lado: Lado | undefined,
) {
  return useQuery({
    queryKey: claves.lugares(municipio, cuadraId ?? '', lado ?? 'par'),
    queryFn: () =>
      api<LugaresDeMano>(
        `municipios/${municipio}/cuadras/${cuadraId ?? ''}/lugares?lado=${lado ?? 'par'}`,
      ),
    enabled: cuadraId !== undefined && lado !== undefined,
    refetchInterval: 30_000,
  });
}

export function useEstacionamientoActivo(municipio: string, habilitado = true) {
  return useQuery({
    queryKey: claves.activo(municipio),
    queryFn: () => api<Estacionamiento | null>(`municipios/${municipio}/estacionamientos/activo`),
    enabled: habilitado,
    // Mantiene al día el importe acumulado y detecta el cierre automático.
    refetchInterval: 30_000,
  });
}

export function useBilletera(municipio: string, habilitado = true) {
  return useQuery({
    queryKey: claves.billetera(municipio),
    queryFn: () => api<Billetera>(`municipios/${municipio}/billetera`),
    enabled: habilitado,
  });
}

export function useVehiculos(habilitado = true) {
  return useQuery({
    queryKey: claves.vehiculos,
    queryFn: () => api<Vehiculo[]>('vehiculos'),
    enabled: habilitado,
  });
}
