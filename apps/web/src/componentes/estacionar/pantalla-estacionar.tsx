'use client';

import type { Mapa as MapaDeCuadras, MunicipioPublico } from '@parkia/contracts';
import type { Lado } from '@parkia/domain';
import { Wallet } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Isotipo } from '@/componentes/marca';
import { Mapa, type Ubicacion } from '@/componentes/mapa';
import { Esqueleto } from '@/componentes/ui';
import { useBilletera, useEstacionamientoActivo, useUbicacionEnCuadra } from '@/lib/hooks';

import { HojaEnCurso } from './hoja-en-curso';
import { HojaNueva, type Eleccion } from './hoja-nueva';
import { HojaSinSesion } from './hoja-sin-sesion';

/** Contenedor de la hoja: inferior en el celular, panel lateral en escritorio. */
function Hoja({ children }: { children: ReactNode }) {
  return (
    <aside className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex max-h-full flex-col justify-end lg:inset-y-5 lg:right-auto lg:left-5 lg:w-[26rem] lg:justify-start">
      <div className="pointer-events-auto max-h-[calc(100%-5rem)] animate-subir overflow-y-auto rounded-t-[1.75rem] bg-superficie shadow-flotante lg:max-h-full lg:rounded-tarjeta">
        <div className="sticky top-0 flex justify-center bg-superficie pt-2.5 pb-1 lg:hidden">
          <span className="h-1.5 w-10 rounded-full bg-borde-fuerte" aria-hidden />
        </div>
        <div className="px-5 pt-2 pb-5 lg:p-6">{children}</div>
      </div>
    </aside>
  );
}

function BarraFlotante({
  municipio,
  haySesion,
}: {
  municipio: MunicipioPublico;
  haySesion: boolean;
}) {
  const billetera = useBilletera(municipio.slug, haySesion);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 pr-16 lg:hidden">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-superficie/95 py-1.5 pr-4 pl-1.5 shadow-tarjeta backdrop-blur">
        <Isotipo className="size-8" />
        <div className="leading-tight">
          <p className="text-sm font-extrabold">{municipio.nombre}</p>
          <p className="text-[0.65rem] font-semibold whitespace-nowrap text-tinta-tenue">
            Estacionamiento medido
          </p>
        </div>
      </div>
      {haySesion && (
        <Link
          href={`/${municipio.slug}/saldo` as Route}
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-superficie/95 px-4 text-sm font-bold shadow-tarjeta backdrop-blur"
        >
          <Wallet className="size-4 text-marca" aria-hidden />
          {billetera.data ? (
            <span className="cifras">{billetera.data.saldoFormateado.replace(',00', '')}</span>
          ) : (
            <Esqueleto className="h-4 w-14" />
          )}
        </Link>
      )}
    </div>
  );
}

function HojaCargando() {
  return (
    <div className="space-y-4" aria-busy>
      <Esqueleto className="h-4 w-24" />
      <Esqueleto className="h-7 w-48" />
      <Esqueleto className="h-14 w-full" />
      <Esqueleto className="h-14 w-full rounded-control" />
    </div>
  );
}

/** Primera mano donde se puede estacionar. */
function manoHabilitada(lugares: Record<Lado, number>): Lado {
  return lugares.par > 0 || lugares.impar === 0 ? 'par' : 'impar';
}

export function PantallaEstacionar({
  municipio,
  mapa,
  haySesion,
}: {
  municipio: MunicipioPublico;
  mapa: MapaDeCuadras;
  haySesion: boolean;
}) {
  const [ubicacion, setUbicacion] = useState<Ubicacion>();
  // Lo que el conductor eligió a mano prevalece sobre lo detectado por GPS.
  const [cuadraTocada, setCuadraTocada] = useState<string>();
  const [ladoElegido, setLadoElegido] = useState<{ cuadraId: string; lado: Lado }>();
  const activo = useEstacionamientoActivo(municipio.slug, haySesion);
  const detectada = useUbicacionEnCuadra(municipio.slug, ubicacion);

  const posicion = detectada.data ?? undefined;
  const cuadraId = cuadraTocada ?? posicion?.cuadra.id;
  const cuadra = mapa.cuadras.features.find((c) => c.id === cuadraId);
  const zona = mapa.zonas.find((z) => z.id === cuadra?.properties.zonaId);

  let eleccion: Eleccion | undefined;
  if (cuadra && zona) {
    const enEsaCuadra = posicion?.cuadra.id === cuadra.id ? posicion : undefined;
    const lado =
      (ladoElegido?.cuadraId === cuadra.id ? ladoElegido.lado : undefined) ??
      enEsaCuadra?.lado ??
      manoHabilitada(cuadra.properties.lugares);
    eleccion = {
      cuadra,
      zona,
      lado,
      // La altura del GPS solo vale si es la misma mano; si no, la API usa la mitad de la cuadra.
      altura: enEsaCuadra?.lado === lado ? enEsaCuadra.altura : undefined,
      detectada: Boolean(enEsaCuadra),
    };
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* MapLibre fuerza position: relative en su contenedor: el posicionamiento va afuera. */}
      <div className="absolute inset-0">
        <Mapa
          mapa={mapa}
          cuadraSeleccionada={activo.data?.ubicacion?.cuadraId ?? cuadraId}
          alUbicar={setUbicacion}
          alTocarCuadra={setCuadraTocada}
          className="size-full"
        />
      </div>

      <BarraFlotante municipio={municipio} haySesion={haySesion} />

      <Hoja>
        {!haySesion ? (
          <HojaSinSesion municipio={municipio} zona={zona ?? mapa.zonas[0]} />
        ) : activo.isPending ? (
          <HojaCargando />
        ) : activo.data ? (
          <HojaEnCurso municipio={municipio} estacionamiento={activo.data} />
        ) : (
          <HojaNueva
            municipio={municipio}
            eleccion={eleccion}
            alElegirLado={(lado) => {
              if (cuadra) setLadoElegido({ cuadraId: cuadra.id, lado });
            }}
            {...(posicion &&
              cuadraTocada &&
              cuadraTocada !== posicion.cuadra.id && {
                alUsarUbicacion: () => {
                  setCuadraTocada(undefined);
                },
              })}
            buscando={detectada.isFetching && !posicion}
            fueraDeZona={detectada.data === null && !cuadraTocada}
          />
        )}
      </Hoja>
    </div>
  );
}
