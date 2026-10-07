import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Navegacion } from '@/componentes/navegacion';
import { entornoParkia } from '@/lib/servidor/entorno';
import { municipioPorSlug } from '@/lib/servidor/municipios';

export async function generateMetadata({ params }: LayoutProps<'/[municipio]'>): Promise<Metadata> {
  const municipio = await municipioPorSlug((await params).municipio);
  return municipio
    ? { title: { default: municipio.nombre, template: `%s · ${municipio.nombre}` } }
    : {};
}

export default async function LayoutMunicipio({ params, children }: LayoutProps<'/[municipio]'>) {
  const { municipio: slug } = await params;
  const municipio = await municipioPorSlug(slug);
  if (!municipio) notFound();

  return (
    <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {entornoParkia() === 'demo' && (
        <p className="bg-alerta px-4 py-1.5 text-center text-xs font-semibold text-black">
          Demostración · el saldo es de prueba y no se cobra dinero real
        </p>
      )}
      {children}
      <Navegacion municipio={municipio.slug} />
    </div>
  );
}
