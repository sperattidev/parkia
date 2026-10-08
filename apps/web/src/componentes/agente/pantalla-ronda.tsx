'use client';

import { MousePointerClick, Radar as IconoRadar } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Hoja } from '@/componentes/hoja';
import { Mapa, type Aviso } from '@/componentes/mapa';
import { useJornada, useRadar } from '@/lib/agente';
import { useUbicacionEnCuadra } from '@/lib/hooks';

import { PadronDeCuadra } from './padron';
import { EstadoDelGps } from './piezas';
import { useRonda } from './ronda';

/**
 * Ronda del agente: el mapa marca qué cuadras ya se controlaron hoy (las
 * demás se ven tenues) y dónde hay vehículos vencidos o por vencer. Al
 * caminar, la hoja muestra el padrón de la cuadra en la que está parado.
 */
export function PantallaRonda() {
  const { municipio, mapa, posicion } = useRonda();
  const parametros = useSearchParams();
  const [cuadraTocada, setCuadraTocada] = useState(parametros.get('cuadra') ?? undefined);
  const detectada = useUbicacionEnCuadra(municipio.slug, posicion);
  const jornada = useJornada(municipio.slug);
  const radar = useRadar(municipio.slug, posicion);

  const posicionEnCuadra = detectada.data ?? undefined;
  const cuadraId = cuadraTocada ?? posicionEnCuadra?.cuadra.id;
  const esDetectada = cuadraId !== undefined && cuadraId === posicionEnCuadra?.cuadra.id;

  const cobertura = jornada.data?.cobertura;
  const atenuadas = useMemo(() => {
    if (!cobertura) return undefined;
    const controladas = new Set(cobertura.map((c) => c.cuadraId));
    return new Set(mapa.cuadras.features.filter((c) => !controladas.has(c.id)).map((c) => c.id));
  }, [cobertura, mapa]);

  const avisos = useMemo<Aviso[]>(
    () => [
      ...(radar.data?.porVencer ?? []).map((a) => ({
        id: a.estacionamientoId,
        posicion: a.posicion,
        tono: 'alerta' as const,
      })),
      ...(radar.data?.vencidos ?? []).map((a) => ({
        id: a.estacionamientoId,
        posicion: a.posicion,
        tono: 'peligro' as const,
      })),
    ],
    [radar.data],
  );

  const total = mapa.cuadras.features.length;
  const controladas = cobertura?.length ?? 0;
  const vencidos = radar.data?.vencidos.length ?? 0;

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0">
        <Mapa
          mapa={mapa}
          cuadraSeleccionada={cuadraId}
          atenuadas={atenuadas}
          avisos={avisos}
          alTocarCuadra={setCuadraTocada}
          className="size-full"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-2 p-3 pr-16 lg:left-[27.5rem]">
        <div className="pointer-events-auto rounded-2xl bg-superficie/95 px-3.5 py-2 shadow-tarjeta backdrop-blur">
          <p className="text-[0.65rem] font-bold tracking-wider text-tinta-tenue uppercase">
            Cobertura hoy
          </p>
          <p className="cifras flex items-center gap-2 text-sm font-extrabold">
            {controladas} de {total} cuadras
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
              <span
                className="block h-full rounded-full bg-marca"
                style={{ width: `${String(total ? (controladas / total) * 100 : 0)}%` }}
              />
            </span>
          </p>
          <EstadoDelGps className="mt-0.5" />
        </div>
        {vencidos > 0 && (
          <Link
            href={`/agente/${municipio.slug}/radar` as Route}
            className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-peligro px-3.5 py-2.5 text-sm font-bold text-white shadow-tarjeta"
          >
            <IconoRadar className="size-4" aria-hidden />
            {vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'} cerca
          </Link>
        )}
      </div>

      <Hoja compacta>
        {cuadraId ? (
          <PadronDeCuadra
            key={cuadraId}
            cuadraId={cuadraId}
            detectada={esDetectada}
            ladoDetectado={esDetectada ? posicionEnCuadra.lado : undefined}
            alUsarUbicacion={
              cuadraTocada && posicionEnCuadra && !esDetectada
                ? () => {
                    setCuadraTocada(undefined);
                  }
                : undefined
            }
          />
        ) : (
          <div>
            <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">Ronda</p>
            <h1 className="mt-0.5 text-2xl leading-tight font-extrabold tracking-tight">
              Caminá o elegí una cuadra
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-tinta-suave">
              <MousePointerClick className="size-4 shrink-0" aria-hidden />
              Con GPS, el padrón de la cuadra aparece solo. También podés tocarla en el mapa.
            </p>
          </div>
        )}
      </Hoja>
    </div>
  );
}
