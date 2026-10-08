'use client';

import type { Control, Jornada, Padron, Radar } from '@parkia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './cliente';

export const clavesDelAgente = {
  padron: (municipio: string, cuadraId: string) =>
    ['agente', municipio, 'padron', cuadraId] as const,
  radar: (municipio: string) => ['agente', municipio, 'radar'] as const,
  jornada: (municipio: string) => ['agente', municipio, 'jornada'] as const,
  todo: (municipio: string) => ['agente', municipio] as const,
};

/** Posición redondeada a ~10 m: el radar no se vuelve a pedir por cada paso. */
function aproximada(ubicacion: { lat: number; lng: number } | undefined) {
  return ubicacion ? { lat: ubicacion.lat.toFixed(4), lng: ubicacion.lng.toFixed(4) } : undefined;
}

export function usePadron(municipio: string, cuadraId: string | undefined) {
  return useQuery({
    queryKey: clavesDelAgente.padron(municipio, cuadraId ?? ''),
    queryFn: () => api<Padron>(`municipios/${municipio}/agente/cuadras/${cuadraId ?? ''}/padron`),
    enabled: cuadraId !== undefined,
    refetchInterval: 20_000,
  });
}

export function useRadar(municipio: string, ubicacion: { lat: number; lng: number } | undefined) {
  const cerca = aproximada(ubicacion);
  return useQuery({
    queryKey: [...clavesDelAgente.radar(municipio), cerca?.lat, cerca?.lng],
    queryFn: () =>
      api<Radar>(
        `municipios/${municipio}/agente/radar${cerca ? `?lat=${cerca.lat}&lng=${cerca.lng}` : ''}`,
      ),
    refetchInterval: 30_000,
    placeholderData: (anterior) => anterior,
  });
}

export function useJornada(municipio: string) {
  return useQuery({
    queryKey: clavesDelAgente.jornada(municipio),
    queryFn: () => api<Jornada>(`municipios/${municipio}/agente/jornada`),
    refetchInterval: 60_000,
  });
}

export function useControlar(municipio: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (solicitud: { patente: string; lat: number; lng: number; cuadraId?: string }) =>
      api<Control>(`municipios/${municipio}/controles`, { metodo: 'POST', cuerpo: solicitud }),
    // Un control cambia el padrón, el radar y la jornada.
    onSuccess: () => cliente.invalidateQueries({ queryKey: clavesDelAgente.todo(municipio) }),
  });
}
