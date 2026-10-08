import type { Mapa } from '@parkia/contracts';
import { FlaskConical } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { NavegacionDelAgente } from '@/componentes/agente/navegacion';
import { BotonSalir } from '@/componentes/boton-salir';
import { ProveedorDeRonda } from '@/componentes/agente/ronda';
import { Isotipo } from '@/componentes/marca';
import { obtenerDeLaApi } from '@/lib/servidor/api';
import { entornoParkia } from '@/lib/servidor/entorno';
import { municipioPorSlug } from '@/lib/servidor/municipios';
import { municipiosDeControl, personalActual } from '@/lib/servidor/personal';

export async function generateMetadata({
  params,
}: LayoutProps<'/agente/[municipio]'>): Promise<Metadata> {
  const municipio = await municipioPorSlug((await params).municipio);
  return municipio
    ? { title: { default: `Control · ${municipio.nombre}`, template: `%s · Control` } }
    : {};
}

/** App de control: solo para personal con rol de agente (o admin) en el municipio. */
export default async function LayoutAgente({
  params,
  children,
}: LayoutProps<'/agente/[municipio]'>) {
  const { municipio: slug } = await params;
  const usuario = await personalActual();
  if (!municipiosDeControl(usuario).includes(slug)) redirect('/agente');

  const [municipio, mapa] = await Promise.all([
    municipioPorSlug(slug),
    obtenerDeLaApi<Mapa>(`/v1/municipios/${slug}/mapa`),
  ]);
  if (!municipio || !mapa) notFound();

  return (
    <ProveedorDeRonda municipio={municipio} mapa={mapa}>
      <div className="flex h-dvh flex-col">
        {entornoParkia() === 'demo' && (
          <p className="flex items-center justify-center gap-1.5 bg-alerta px-4 py-1 text-center text-[0.7rem] font-bold text-[#3d2600]">
            <FlaskConical className="size-3.5" aria-hidden />
            Demostración · los controles no tienen validez legal
          </p>
        )}

        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-borde bg-superficie px-4 pt-[env(safe-area-inset-top)] lg:h-16 lg:px-6">
          <Link
            href={`/agente/${municipio.slug}` as Route}
            className="flex min-w-0 items-center gap-2.5"
            aria-label="Control, inicio"
          >
            <Isotipo className="size-8" />
            <span className="min-w-0 leading-tight">
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                Control
                <span className="rounded-full bg-tinta px-1.5 py-px text-[0.6rem] font-bold tracking-wider text-superficie uppercase">
                  Agente
                </span>
              </span>
              <span className="block truncate text-xs text-tinta-suave">
                {municipio.nombre} · {usuario.nombre ?? usuario.email}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <NavegacionDelAgente municipio={municipio.slug} ubicacion="superior" />
            </div>
            <BotonSalir compacto />
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>

        <NavegacionDelAgente municipio={municipio.slug} ubicacion="inferior" />
      </div>
    </ProveedorDeRonda>
  );
}
