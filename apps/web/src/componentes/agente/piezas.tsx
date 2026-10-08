'use client';

import type { ResultadoDeControl, Situacion } from '@parkia/contracts';
import { LocateFixed, LocateOff } from 'lucide-react';

import { Etiqueta } from '@/componentes/ui';
import { cn } from '@/lib/cn';
import { hora } from '@/lib/formato';
import { useAhora } from '@/lib/hooks';

import { useRonda } from './ronda';

/** Minutos enteros entre dos instantes (positivo si `hasta` es posterior). */
export function minutosEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / 60_000);
}

/** «hace 12 min», «hace 2 h», o la hora si fue hace mucho. */
export function hace(iso: string, ahora: Date, zonaHoraria: string): string {
  const minutos = minutosEntre(new Date(iso), ahora);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${String(minutos)} min`;
  if (minutos < 180) return `hace ${String(Math.floor(minutos / 60))} h`;
  return `a las ${hora(iso, zonaHoraria)}`;
}

/** Estado de un vehículo de un vistazo: vigente, por vencer o vencido. */
export function ChipDeSituacion({ situacion, venceEn }: { situacion: Situacion; venceEn: string }) {
  const { municipio } = useRonda();
  const ahora = useAhora(15_000);
  if (situacion === 'vencido') {
    return (
      <Etiqueta tono="peligro" punto>
        Vencido {hace(venceEn, ahora, municipio.zonaHoraria)}
      </Etiqueta>
    );
  }
  if (situacion === 'por_vencer') {
    const minutos = Math.max(minutosEntre(ahora, new Date(venceEn)), 0);
    return <Etiqueta tono="alerta">Vence en {String(minutos)} min</Etiqueta>;
  }
  return <Etiqueta tono="exito">Hasta {hora(venceEn, municipio.zonaHoraria)}</Etiqueta>;
}

export const TEXTOS_DE_RESULTADO: Record<ResultadoDeControl, string> = {
  habilitado: 'Habilitado',
  fuera_de_horario: 'Fuera de horario',
  sin_estacionamiento: 'Sin estacionamiento',
  vencido: 'Vencido',
  otra_zona: 'Pagó en otra zona',
  fuera_de_zona: 'Fuera de zona',
};

export const TONOS_DE_RESULTADO: Record<ResultadoDeControl, 'exito' | 'peligro' | 'neutro'> = {
  habilitado: 'exito',
  fuera_de_horario: 'exito',
  sin_estacionamiento: 'peligro',
  vencido: 'peligro',
  otra_zona: 'peligro',
  fuera_de_zona: 'neutro',
};

/** Indicador del GPS: el agente tiene que saber si su ubicación es confiable. */
export function EstadoDelGps({ className }: { className?: string }) {
  const { gps, posicion } = useRonda();
  if (gps === 'activo' && posicion) {
    const preciso = posicion.precision <= 20;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold',
          preciso ? 'text-exito' : 'text-alerta',
          className,
        )}
      >
        <LocateFixed className="size-3.5" aria-hidden />
        GPS ±{Math.round(posicion.precision)} m
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-tenue',
        className,
      )}
    >
      <LocateOff className="size-3.5" aria-hidden />
      {gps === 'buscando'
        ? 'Buscando GPS…'
        : gps === 'denegado'
          ? 'GPS sin permiso'
          : 'GPS no disponible'}
    </span>
  );
}
