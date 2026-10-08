'use client';

import { useMemo } from 'react';

import { Mapa } from '@/componentes/mapa';
import { Esqueleto } from '@/componentes/ui';
import { useCuadras, useZonas } from '@/lib/gestion';

import { useGestion } from './contexto';
import { ContenidoDeGestion, EncabezadoDeSeccion } from './piezas';

/** Escala de ocupación: verde con lugar, ámbar casi llena, roja llena. */
const ESCALA = [
  { hasta: 0.5, color: '#0E9F6E', texto: 'Menos de la mitad' },
  { hasta: 0.85, color: '#F59E0B', texto: 'Casi llena' },
  { hasta: Infinity, color: '#E02D3C', texto: 'Llena' },
] as const;

function colorDeOcupacion(proporcion: number): string {
  return (ESCALA.find((tramo) => proporcion < tramo.hasta) ?? ESCALA[2]).color;
}

export function PantallaOcupacion() {
  const { municipio } = useGestion();
  const zonas = useZonas(municipio.slug);
  const cuadras = useCuadras(municipio.slug, 30_000);

  const datos = useMemo(() => {
    if (!zonas.data || !cuadras.data) return undefined;
    const tarifadas = cuadras.data.features.filter(
      (c) => c.properties.activa && c.properties.zonaId !== null,
    );
    const filas = tarifadas
      .map((c) => {
        const capacidad = c.properties.lugares.par + c.properties.lugares.impar;
        const ocupados = c.properties.ocupados.par + c.properties.ocupados.impar;
        return { cuadra: c, capacidad, ocupados, proporcion: capacidad ? ocupados / capacidad : 0 };
      })
      .sort((a, b) => b.proporcion - a.proporcion || b.ocupados - a.ocupados);
    return {
      mapa: {
        zonas: zonas.data.map(({ id, nombre, color }) => ({ id, nombre, color })),
        cuadras: { ...cuadras.data, features: tarifadas },
      },
      colores: new Map(filas.map((f) => [f.cuadra.id, colorDeOcupacion(f.proporcion)])),
      filas,
      ocupados: filas.reduce((t, f) => t + f.ocupados, 0),
      capacidad: filas.reduce((t, f) => t + f.capacidad, 0),
    };
  }, [zonas.data, cuadras.data]);

  return (
    <ContenidoDeGestion>
      <EncabezadoDeSeccion
        titulo="Ocupación en este momento"
        descripcion="Estacionamientos pagos en curso sobre la capacidad de cada cuadra. Se actualiza cada 30 segundos."
        {...(datos && {
          accion: (
            <p className="cifras rounded-xl bg-superficie px-4 py-2 text-sm font-bold shadow-suave">
              {datos.ocupados} de {datos.capacidad} lugares pagos
            </p>
          ),
        })}
      />

      {!datos ? (
        <Esqueleto className="h-[32rem] rounded-tarjeta" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="relative h-[60vh] min-h-96 overflow-hidden rounded-tarjeta bg-superficie shadow-tarjeta">
            <div className="absolute inset-0">
              <Mapa
                mapa={datos.mapa}
                colores={datos.colores}
                conHoja={false}
                geolocalizarAlAbrir={false}
                className="size-full"
              />
            </div>
            <ul className="absolute bottom-3 left-3 z-10 space-y-1 rounded-xl bg-superficie/95 px-3 py-2 text-xs font-semibold shadow-tarjeta backdrop-blur">
              {ESCALA.map((tramo) => (
                <li key={tramo.texto} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-5 rounded-full"
                    style={{ backgroundColor: tramo.color }}
                    aria-hidden
                  />
                  {tramo.texto}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
            <h2 className="font-extrabold">Cuadras más ocupadas</h2>
            <ol className="mt-4 space-y-3">
              {datos.filas.slice(0, 12).map(({ cuadra, ocupados, capacidad, proporcion }) => (
                <li key={cuadra.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold">
                      {cuadra.properties.calle} {cuadra.properties.alturaDesde}
                    </span>
                    <span className="cifras shrink-0 text-tinta-suave">
                      {ocupados}/{capacidad}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${String(Math.min(proporcion, 1) * 100)}%`,
                        backgroundColor: colorDeOcupacion(proporcion),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </ContenidoDeGestion>
  );
}
