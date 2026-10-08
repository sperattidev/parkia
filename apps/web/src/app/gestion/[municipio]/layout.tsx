import { Building2, FlaskConical, KeyRound, ScanLine } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { BotonSalir } from '@/componentes/boton-salir';
import { ProveedorDeGestion } from '@/componentes/gestion/contexto';
import { MenuLateral, PestanasDeGestion } from '@/componentes/gestion/navegacion';
import { Isotipo, Marca } from '@/componentes/marca';
import { entornoParkia } from '@/lib/servidor/entorno';
import { municipioPorSlug } from '@/lib/servidor/municipios';
import { municipiosDeGestion, personalActual } from '@/lib/servidor/personal';

export async function generateMetadata({
  params,
}: LayoutProps<'/gestion/[municipio]'>): Promise<Metadata> {
  const municipio = await municipioPorSlug((await params).municipio);
  return municipio
    ? { title: { default: `Gestión · ${municipio.nombre}`, template: `%s · Gestión` } }
    : {};
}

function Enlace({ href, children }: { href: Route; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-tinta-suave transition-colors hover:bg-superficie-2 hover:text-tinta"
    >
      {children}
    </Link>
  );
}

/** Panel municipal: para administradores del municipio y el equipo de Parkia. */
export default async function LayoutDeGestion({
  params,
  children,
}: LayoutProps<'/gestion/[municipio]'>) {
  const { municipio: slug } = await params;
  const usuario = await personalActual();
  if (!usuario.administradorDeParkia && !municipiosDeGestion(usuario).includes(slug)) {
    redirect('/personal');
  }
  const municipio = await municipioPorSlug(slug);
  if (!municipio) notFound();

  const pie = (
    <div className="space-y-0.5">
      <Enlace href={`/agente/${municipio.slug}` as Route}>
        <ScanLine className="size-4" aria-hidden /> App de control
      </Enlace>
      {usuario.administradorDeParkia && (
        <Enlace href="/plataforma">
          <Building2 className="size-4" aria-hidden /> Panel de Parkia
        </Enlace>
      )}
      <Enlace href="/personal/contrasena">
        <KeyRound className="size-4" aria-hidden /> Cambiar contraseña
      </Enlace>
    </div>
  );

  return (
    <ProveedorDeGestion municipio={municipio} usuario={usuario}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borde bg-superficie px-3 py-5 lg:flex">
          <div className="px-3">
            <Marca />
            <p className="mt-5 text-[0.65rem] font-bold tracking-widest text-tinta-tenue uppercase">
              Gestión municipal
            </p>
            <p className="text-lg leading-tight font-extrabold">{municipio.nombre}</p>
            <p className="text-xs text-tinta-suave">{municipio.provincia}</p>
          </div>
          <div className="mt-6 flex-1 overflow-y-auto">
            <Suspense>
              <MenuLateral municipio={municipio.slug} />
            </Suspense>
          </div>
          <div className="border-t border-borde pt-3">
            {pie}
            <div className="mt-3 flex items-center justify-between gap-2 px-3">
              <p className="min-w-0 truncate text-xs text-tinta-tenue">
                {usuario.nombre ?? usuario.email}
              </p>
              <BotonSalir compacto />
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <span className="flex min-w-0 items-center gap-2.5">
              <Isotipo className="size-8" />
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-extrabold">Gestión · {municipio.nombre}</span>
                <span className="block truncate text-xs text-tinta-suave">
                  {usuario.nombre ?? usuario.email}
                </span>
              </span>
            </span>
            <BotonSalir compacto />
          </div>
          <Suspense>
            <PestanasDeGestion municipio={municipio.slug} />
          </Suspense>
        </header>

        <div className="min-w-0 flex-1">
          {entornoParkia() === 'demo' && (
            <p className="flex items-center justify-center gap-1.5 bg-alerta px-4 py-1 text-center text-[0.7rem] font-bold text-[#3d2600]">
              <FlaskConical className="size-3.5" aria-hidden />
              Demostración · los importes son de prueba
            </p>
          )}
          {children}
        </div>
      </div>
    </ProveedorDeGestion>
  );
}
