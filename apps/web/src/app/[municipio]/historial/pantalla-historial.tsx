'use client';

import type { Estacionamiento, MunicipioPublico } from '@parkia/contracts';
import { useQuery } from '@tanstack/react-query';

import { Cargando, Etiqueta, Tarjeta } from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';
import { duracion, fechaCorta, hora } from '@/lib/formato';
import { claves } from '@/lib/hooks';

export function PantallaHistorial({ municipio }: { municipio: MunicipioPublico }) {
  const zh = municipio.zonaHoraria;
  const historial = useQuery({
    queryKey: claves.historial(municipio.slug),
    queryFn: () => api<Estacionamiento[]>(`municipios/${municipio.slug}/estacionamientos`),
  });

  if (historial.isPending) return <Cargando />;
  if (historial.isError) return <p className="text-peligro">{mensajeDeError(historial.error)}</p>;
  if (historial.data.length === 0) {
    return (
      <Tarjeta>
        <p className="text-tinta-suave">Todavía no estacionaste en {municipio.nombre}.</p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="p-0">
      <ul className="divide-y divide-borde">
        {historial.data.map((estacionamiento) => {
          const fin = estacionamiento.fin ?? new Date().toISOString();
          return (
            <li key={estacionamiento.id} className="flex items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold tracking-wider">{estacionamiento.patente}</p>
                <p className="text-sm text-tinta-suave">
                  {fechaCorta(estacionamiento.inicio, zh)} · {hora(estacionamiento.inicio, zh)}–
                  {hora(fin, zh)} · {estacionamiento.zona.nombre}
                </p>
                <p className="text-sm text-tinta-suave">
                  {duracion(new Date(fin).getTime() - new Date(estacionamiento.inicio).getTime())}
                </p>
              </div>
              {estacionamiento.estado === 'activo' ? (
                <Etiqueta tono="exito">En curso</Etiqueta>
              ) : (
                <span className="font-semibold tabular-nums">
                  {estacionamiento.importeFormateado}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
