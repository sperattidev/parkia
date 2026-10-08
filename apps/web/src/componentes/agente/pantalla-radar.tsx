'use client';

import type { AvisoDelRadar } from '@parkia/contracts';
import { Map as IconoMapa, Radar, ScanLine, ShieldCheck } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { Placa } from '@/componentes/placa';
import { EstadoVacio, Esqueleto, TituloDeSeccion } from '@/componentes/ui';
import { useRadar } from '@/lib/agente';
import { hora } from '@/lib/formato';

import { ChipDeSituacion, EstadoDelGps } from './piezas';
import { useRonda } from './ronda';

function distancia(metros: number | null): string | null {
  if (metros === null) return null;
  return metros < 1000 ? `a ${String(metros)} m` : `a ${(metros / 1000).toFixed(1)} km`;
}

function TarjetaDeAviso({ aviso }: { aviso: AvisoDelRadar }) {
  const { municipio } = useRonda();
  const atendido =
    aviso.situacion === 'vencido' &&
    aviso.controladoEn !== null &&
    aviso.controladoEn >= aviso.venceEn;
  const parametros = new URLSearchParams({
    cuadra: aviso.ubicacion.cuadraId,
    patente: aviso.patente,
  });
  return (
    <li className={atendido ? 'opacity-60' : undefined}>
      <article className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
        <div className="flex items-start justify-between gap-3">
          <Placa patente={aviso.patente} tamano="chica" />
          <ChipDeSituacion situacion={aviso.situacion} venceEn={aviso.venceEn} />
        </div>
        <p className="mt-3 font-bold">{aviso.ubicacion.direccion}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-tinta-tenue">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: aviso.zona.color }}
              aria-hidden
            />
            {aviso.zona.nombre}
          </span>
          {distancia(aviso.distanciaMetros) && <span>· {distancia(aviso.distanciaMetros)}</span>}
          {atendido && aviso.controladoEn && (
            <span className="flex items-center gap-1 text-exito">
              · <ShieldCheck className="size-3.5" aria-hidden /> Controlado{' '}
              {hora(aviso.controladoEn, municipio.zonaHoraria)}
            </span>
          )}
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <Link
            href={`/agente/${municipio.slug}?cuadra=${aviso.ubicacion.cuadraId}` as Route}
            className="flex h-11 items-center justify-center gap-2 rounded-control bg-superficie-2 text-sm font-bold transition hover:bg-borde"
          >
            <IconoMapa className="size-4" aria-hidden /> Ver cuadra
          </Link>
          <Link
            href={`/agente/${municipio.slug}/controlar?${parametros.toString()}` as Route}
            className="flex h-11 items-center justify-center gap-2 rounded-control bg-marca text-sm font-bold text-sobre-marca transition hover:bg-marca-fuerte"
          >
            <ScanLine className="size-4" aria-hidden /> Controlar
          </Link>
        </div>
      </article>
    </li>
  );
}

/**
 * Radar: la lista de trabajo del agente. Vencidos de las últimas 2 horas que
 * nadie controló, los más cercanos primero, y los que están por vencer.
 */
export function PantallaRadar() {
  const { municipio, posicion } = useRonda();
  const radar = useRadar(municipio.slug, posicion);

  return (
    <main className="mx-auto w-full max-w-xl animate-aparecer space-y-6 px-4 pt-5 pb-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">
            Se actualiza solo
          </p>
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">Radar</h1>
        </div>
        <EstadoDelGps />
      </header>

      {!radar.data ? (
        <div className="space-y-3" aria-busy>
          <Esqueleto className="h-36 w-full rounded-tarjeta" />
          <Esqueleto className="h-36 w-full rounded-tarjeta" />
        </div>
      ) : radar.data.vencidos.length === 0 && radar.data.porVencer.length === 0 ? (
        <EstadoVacio
          Icono={Radar}
          titulo="Nada para atender"
          descripcion="No hay vehículos con saldo agotado en las últimas 2 horas ni por vencer."
        />
      ) : (
        <>
          {radar.data.vencidos.length > 0 && (
            <section>
              <TituloDeSeccion>Vencidos · {radar.data.vencidos.length}</TituloDeSeccion>
              <ul className="space-y-3">
                {radar.data.vencidos.map((aviso) => (
                  <TarjetaDeAviso key={aviso.estacionamientoId} aviso={aviso} />
                ))}
              </ul>
            </section>
          )}
          {radar.data.porVencer.length > 0 && (
            <section>
              <TituloDeSeccion>Por vencer · {radar.data.porVencer.length}</TituloDeSeccion>
              <ul className="space-y-3">
                {radar.data.porVencer.map((aviso) => (
                  <TarjetaDeAviso key={aviso.estacionamientoId} aviso={aviso} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
