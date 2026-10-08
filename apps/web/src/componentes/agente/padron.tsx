'use client';

import type { Lado } from '@parkia/domain';
import type { Padron, VehiculoDelPadron } from '@parkia/contracts';
import {
  CarFront,
  ChevronRight,
  LocateFixed,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { patenteLegible } from '@/componentes/placa';
import { Esqueleto } from '@/componentes/ui';
import { usePadron } from '@/lib/agente';
import { cn } from '@/lib/cn';
import { hora } from '@/lib/formato';
import { useAhora } from '@/lib/hooks';

import { ChipDeSituacion, hace } from './piezas';
import { useRonda } from './ronda';

const LADOS: readonly Lado[] = ['par', 'impar'];

function rutaDeControl(municipio: string, cuadraId: string, patente?: string): Route {
  const parametros = new URLSearchParams({ cuadra: cuadraId, ...(patente && { patente }) });
  return `/agente/${municipio}/controlar?${parametros.toString()}` as Route;
}

function FilaDeVehiculo({ vehiculo, destino }: { vehiculo: VehiculoDelPadron; destino: Route }) {
  const { municipio } = useRonda();
  const controladoDespues =
    vehiculo.controladoEn !== null &&
    (vehiculo.situacion !== 'vencido' || vehiculo.controladoEn >= vehiculo.venceEn);
  return (
    <li>
      <Link
        href={destino}
        className="flex items-center gap-3 rounded-control px-2 py-2.5 transition hover:bg-superficie-2"
      >
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold',
            vehiculo.lugar === null
              ? 'bg-superficie-2 text-tinta-suave'
              : vehiculo.situacion === 'vencido'
                ? 'bg-peligro-suave text-peligro'
                : 'bg-marca-suave text-marca',
          )}
          aria-label={vehiculo.lugar === null ? undefined : `Lugar ${String(vehiculo.lugar)}`}
        >
          {vehiculo.lugar ?? <CarFront className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[1.05rem] font-bold tracking-wider">
            {patenteLegible(vehiculo.patente)}
          </span>
          <span className="flex items-center gap-1 text-xs text-tinta-tenue">
            Altura {vehiculo.altura}
            {controladoDespues && vehiculo.controladoEn && (
              <>
                {' · '}
                <ShieldCheck className="size-3.5 text-exito" aria-hidden />
                Controlado {hora(vehiculo.controladoEn, municipio.zonaHoraria)}
              </>
            )}
          </span>
        </span>
        <ChipDeSituacion situacion={vehiculo.situacion} venceEn={vehiculo.venceEn} />
        <ChevronRight className="size-4 shrink-0 text-tinta-tenue" aria-hidden />
      </Link>
    </li>
  );
}

/** Mapa de lugares numerados: verde pagado, rojo vencido, gris libre o sin pagar. */
function GrillaDeLugares({
  capacidad,
  vehiculos,
}: {
  capacidad: number;
  vehiculos: VehiculoDelPadron[];
}) {
  const porLugar = new Map(vehiculos.flatMap((v) => (v.lugar === null ? [] : [[v.lugar, v]])));
  return (
    <div className="grid grid-cols-9 gap-1" role="list" aria-label="Lugares numerados">
      {Array.from({ length: capacidad }, (_, i) => {
        const numero = i + 1;
        const vehiculo = porLugar.get(numero);
        return (
          <span
            key={numero}
            role="listitem"
            title={vehiculo ? patenteLegible(vehiculo.patente) : 'Sin pago'}
            className={cn(
              'cifras grid h-8 place-items-center rounded-lg text-xs font-bold',
              !vehiculo && 'border border-dashed border-borde-fuerte text-tinta-tenue',
              vehiculo?.situacion === 'vencido' && 'bg-peligro text-white',
              vehiculo && vehiculo.situacion !== 'vencido' && 'bg-exito text-white',
            )}
          >
            {numero}
          </span>
        );
      })}
    </div>
  );
}

function Mano({ padron, lado }: { padron: Padron; lado: Lado }) {
  const { municipio } = useRonda();
  const { capacidad, vehiculos } = padron.manos[lado];
  const pagos = vehiculos.filter((v) => v.situacion !== 'vencido').length;
  const vencidos = vehiculos.length - pagos;

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-extrabold">Mano {lado}</h3>
        <p className="cifras text-xs font-semibold text-tinta-suave">
          {capacidad === 0 ? (
            'No se estaciona'
          ) : (
            <>
              <span className="text-exito">
                {pagos} {pagos === 1 ? 'pago' : 'pagos'}
              </span>
              {vencidos > 0 && (
                <span className="text-peligro">
                  {' '}
                  · {vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'}
                </span>
              )}{' '}
              · capacidad {capacidad}
            </>
          )}
        </p>
      </div>

      {padron.cuadra.lugaresNumerados && capacidad > 0 && (
        <GrillaDeLugares capacidad={capacidad} vehiculos={vehiculos} />
      )}

      {capacidad > 0 && vehiculos.length === 0 ? (
        <p className="flex gap-2 rounded-control bg-alerta-suave p-3 text-sm leading-snug font-medium">
          <ShieldAlert className="size-5 shrink-0 text-alerta" aria-hidden />
          Nadie declaró estacionar en esta mano: cualquier vehículo estacionado está sin pagar.
        </p>
      ) : (
        <ul className="-mx-2">
          {vehiculos.map((vehiculo) => (
            <FilaDeVehiculo
              key={vehiculo.estacionamientoId}
              vehiculo={vehiculo}
              destino={rutaDeControl(municipio.slug, padron.cuadra.id, vehiculo.patente)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Padrón de la cuadra: lo que el agente compara con la calle. Si un vehículo
 * estacionado no figura (o figura vencido), está en infracción.
 */
export function PadronDeCuadra({
  cuadraId,
  detectada,
  ladoDetectado,
  alUsarUbicacion,
}: {
  cuadraId: string;
  detectada: boolean;
  ladoDetectado: Lado | undefined;
  alUsarUbicacion: (() => void) | undefined;
}) {
  const { municipio } = useRonda();
  const ahora = useAhora(30_000);
  const padron = usePadron(municipio.slug, cuadraId);

  if (!padron.data) {
    return (
      <div className="space-y-4" aria-busy>
        <Esqueleto className="h-4 w-28" />
        <Esqueleto className="h-7 w-52" />
        <Esqueleto className="h-24 w-full" />
        <Esqueleto className="h-24 w-full" />
      </div>
    );
  }

  const { cuadra, zona, ultimoControl } = padron.data;
  // La mano donde está parado el agente, primero.
  const lados = ladoDetectado === 'impar' ? [...LADOS].reverse() : LADOS;

  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-tinta-tenue uppercase">
          {detectada && <LocateFixed className="size-3.5 text-marca" aria-hidden />}
          {detectada ? 'Estás en' : 'Cuadra elegida'}
        </p>
        <h1 className="cifras mt-0.5 text-2xl leading-tight font-extrabold tracking-tight">
          {cuadra.calle} {cuadra.alturaDesde}–{cuadra.alturaHasta}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-tinta-suave">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: zona.color }}
              aria-hidden
            />
            {zona.nombre}
            {!zona.enHorarioDeCobro && ' · sin cobro ahora'}
          </span>
          <span className={cn('flex items-center gap-1', !ultimoControl && 'text-alerta')}>
            <ShieldCheck className="size-4" aria-hidden />
            {ultimoControl
              ? `Controlada ${hace(ultimoControl, ahora, municipio.zonaHoraria)}`
              : 'Sin controlar hoy'}
          </span>
        </p>
        {alUsarUbicacion && (
          <button
            type="button"
            onClick={alUsarUbicacion}
            className="mt-2 flex items-center gap-1.5 text-sm font-bold text-marca"
          >
            <LocateFixed className="size-4" aria-hidden /> Volver a mi ubicación
          </button>
        )}
      </div>

      {lados.map((lado) => (
        <Mano key={lado} padron={padron.data} lado={lado} />
      ))}

      <Link
        href={rutaDeControl(municipio.slug, cuadra.id)}
        className="flex h-14 items-center justify-center gap-2 rounded-control bg-marca text-base font-bold text-sobre-marca shadow-marca transition hover:bg-marca-fuerte active:scale-[0.98]"
      >
        <ScanLine className="size-5" aria-hidden /> Controlar una patente acá
      </Link>
    </div>
  );
}
