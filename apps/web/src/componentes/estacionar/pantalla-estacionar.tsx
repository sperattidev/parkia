'use client';

import type { MunicipioPublico, ZonasGeoJson } from '@parkia/contracts';
import { LogIn } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { Mapa, type Ubicacion } from '@/componentes/mapa';
import { Cargando, Tarjeta } from '@/componentes/ui';
import { zonaEnUbicacion } from '@/lib/geo';
import { useEstacionamientoActivo } from '@/lib/hooks';

import { TarjetaEnCurso } from './tarjeta-en-curso';
import { TarjetaNueva } from './tarjeta-nueva';

export function PantallaEstacionar({
  municipio,
  zonas,
  haySesion,
}: {
  municipio: MunicipioPublico;
  zonas: ZonasGeoJson;
  haySesion: boolean;
}) {
  const [ubicacion, setUbicacion] = useState<Ubicacion>();
  const [zonaElegida, setZonaElegida] = useState(
    zonas.features.length === 1 ? zonas.features[0]?.id : undefined,
  );
  const activo = useEstacionamientoActivo(municipio.slug, haySesion);

  const zonaDetectada = ubicacion ? zonaEnUbicacion(zonas, ubicacion) : undefined;
  const zonaActual = zonaDetectada?.id ?? zonaElegida;

  return (
    <div className="relative h-[calc(100dvh-4rem-env(safe-area-inset-bottom))]">
      {/* MapLibre fuerza position: relative en su contenedor: el posicionamiento va afuera. */}
      <div className="absolute inset-0">
        <Mapa
          zonas={zonas}
          zonaSeleccionada={activo.data?.zona.id ?? zonaActual}
          alUbicar={setUbicacion}
          className="size-full"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <div className="pointer-events-auto mx-auto max-w-lg shadow-flotante">
          {!haySesion ? (
            <Tarjeta className="space-y-4">
              <div>
                <p className="text-sm text-tinta-suave">{municipio.nombre}</p>
                <h1 className="text-xl font-bold">Estacioná desde el celular</h1>
                <p className="mt-1 text-tinta-suave">
                  Pagás solo el tiempo que usás y te avisamos antes de que se termine el saldo.
                </p>
              </div>
              <Link
                href={`/ingresar?volver=/${municipio.slug}` as Route}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-marca font-semibold text-sobre-marca hover:bg-marca-fuerte"
              >
                <LogIn className="size-5" aria-hidden /> Ingresar para estacionar
              </Link>
            </Tarjeta>
          ) : activo.isPending ? (
            <Tarjeta>
              <Cargando />
            </Tarjeta>
          ) : activo.data ? (
            <TarjetaEnCurso municipio={municipio} estacionamiento={activo.data} />
          ) : (
            <TarjetaNueva
              municipio={municipio}
              zonas={zonas}
              zonaId={zonaActual}
              alElegirZona={setZonaElegida}
              detectada={Boolean(zonaDetectada)}
              fueraDeZona={Boolean(ubicacion) && !zonaDetectada}
            />
          )}
        </div>
      </div>
    </div>
  );
}
