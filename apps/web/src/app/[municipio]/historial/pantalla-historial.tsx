'use client';

import type { Estacionamiento, MunicipioPublico } from '@parkia/contracts';
import { useQuery } from '@tanstack/react-query';
import { CarFront, History } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { patenteLegible } from '@/componentes/placa';
import { Esqueleto, EstadoVacio, Etiqueta, Tarjeta, TituloDeSeccion } from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';
import { agruparPorDia, duracion, hora, pesos } from '@/lib/formato';
import { claves, useAhora } from '@/lib/hooks';

export function PantallaHistorial({ municipio }: { municipio: MunicipioPublico }) {
  const zh = municipio.zonaHoraria;
  const ahora = useAhora(60_000);
  const historial = useQuery({
    queryKey: claves.historial(municipio.slug),
    queryFn: () => api<Estacionamiento[]>(`municipios/${municipio.slug}/estacionamientos`),
  });

  if (historial.isPending) {
    return (
      <div className="space-y-3">
        <Esqueleto className="h-24 rounded-tarjeta" />
        <Esqueleto className="h-48 rounded-tarjeta" />
      </div>
    );
  }
  if (historial.isError) return <p className="text-peligro">{mensajeDeError(historial.error)}</p>;
  if (historial.data.length === 0) {
    return (
      <Tarjeta>
        <EstadoVacio
          Icono={History}
          titulo="Todavía no estacionaste"
          descripcion={`Cuando estaciones en ${municipio.nombre}, vas a ver acá cada estadía y lo que pagaste.`}
          accion={
            <Link
              href={`/${municipio.slug}` as Route}
              className="rounded-full bg-marca px-5 py-2.5 text-sm font-bold text-sobre-marca shadow-marca"
            >
              Ir a estacionar
            </Link>
          }
        />
      </Tarjeta>
    );
  }

  const finalizados = historial.data.filter((e) => e.estado === 'finalizado');
  const total = finalizados.reduce((suma, e) => suma + e.importe, 0);
  const grupos = agruparPorDia(historial.data, (e) => e.inicio, ahora, zh);

  return (
    <>
      <dl className="grid grid-cols-2 gap-3">
        <Tarjeta className="py-4">
          <dt className="text-xs font-semibold text-tinta-tenue">Estacionamientos</dt>
          <dd className="cifras mt-1 text-2xl font-extrabold">{historial.data.length}</dd>
        </Tarjeta>
        <Tarjeta className="py-4">
          <dt className="text-xs font-semibold text-tinta-tenue">Total pagado</dt>
          <dd className="cifras mt-1 text-2xl font-extrabold">{pesos(total).replace(',00', '')}</dd>
        </Tarjeta>
      </dl>

      {grupos.map((grupo) => (
        <section key={grupo.titulo}>
          <TituloDeSeccion>{grupo.titulo}</TituloDeSeccion>
          <Tarjeta className="p-0">
            <ul className="divide-y divide-borde">
              {grupo.elementos.map((estacionamiento) => {
                const fin = estacionamiento.fin ?? ahora.toISOString();
                const activo = estacionamiento.estado === 'activo';
                return (
                  <li
                    key={estacionamiento.id}
                    className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-superficie-2 text-tinta-suave">
                      <CarFront className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.95rem] font-bold">
                        {estacionamiento.zona.nombre}
                      </p>
                      <p className="cifras truncate text-xs text-tinta-tenue">
                        <span className="font-mono font-semibold tracking-wider text-tinta-suave">
                          {patenteLegible(estacionamiento.patente)}
                        </span>{' '}
                        · {hora(estacionamiento.inicio, zh)}–{activo ? 'ahora' : hora(fin, zh)} ·{' '}
                        {duracion(
                          new Date(fin).getTime() - new Date(estacionamiento.inicio).getTime(),
                        )}
                      </p>
                    </div>
                    {activo ? (
                      <Etiqueta tono="exito" punto>
                        En curso
                      </Etiqueta>
                    ) : (
                      <span className="cifras text-[0.95rem] font-bold">
                        {estacionamiento.importeFormateado}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        </section>
      ))}
      <p className="text-center text-xs text-tinta-tenue">Se muestran los últimos 20.</p>
    </>
  );
}
