import { FlaskConical } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Marca } from '@/componentes/marca';
import { NavegacionInferior, NavegacionSuperior } from '@/componentes/navegacion';
import { entornoParkia } from '@/lib/servidor/entorno';
import { municipioPorSlug } from '@/lib/servidor/municipios';

export async function generateMetadata({ params }: LayoutProps<'/[municipio]'>): Promise<Metadata> {
  const municipio = await municipioPorSlug((await params).municipio);
  return municipio
    ? { title: { default: municipio.nombre, template: `%s · ${municipio.nombre}` } }
    : {};
}

/**
 * Estructura de la app: barra superior en escritorio, pestañas inferiores en el
 * celular y el contenido en el medio, ocupando exactamente la pantalla.
 */
export default async function LayoutMunicipio({ params, children }: LayoutProps<'/[municipio]'>) {
  const { municipio: slug } = await params;
  const municipio = await municipioPorSlug(slug);
  if (!municipio) notFound();

  return (
    <div className="flex h-dvh flex-col">
      {entornoParkia() === 'demo' && (
        <p className="flex items-center justify-center gap-1.5 bg-alerta px-4 py-1 text-center text-[0.7rem] font-bold text-[#3d2600]">
          <FlaskConical className="size-3.5" aria-hidden />
          Demostración · el saldo es de prueba y no se cobra dinero real
        </p>
      )}

      <header className="hidden h-16 shrink-0 items-center justify-between border-b border-borde bg-superficie px-6 lg:flex">
        <div className="flex items-center gap-4">
          <Link href={`/${municipio.slug}` as Route} aria-label="Parkia, inicio">
            <Marca />
          </Link>
          <span className="h-6 w-px bg-borde" aria-hidden />
          <span className="text-sm">
            <span className="font-bold">{municipio.nombre}</span>
            <span className="text-tinta-suave"> · {municipio.provincia}</span>
          </span>
        </div>
        <NavegacionSuperior municipio={municipio.slug} />
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>

      <NavegacionInferior municipio={municipio.slug} />
    </div>
  );
}
