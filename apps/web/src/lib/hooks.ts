'use client';

import type { Billetera, Estacionamiento, Vehiculo } from '@parkia/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from './cliente';

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
};

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
