import type { Metadata } from 'next';

import { Marca } from '@/componentes/marca';

import { FormularioDeIngreso } from './formulario';

export const metadata: Metadata = { title: 'Ingresar' };

/** Solo se aceptan rutas internas como destino, para evitar redirecciones abiertas. */
function destinoSeguro(volver: string | string[] | undefined): string {
  return typeof volver === 'string' && /^\/[a-z0-9/-]*$/.test(volver) ? volver : '/';
}

export default async function Ingresar({ searchParams }: PageProps<'/ingresar'>) {
  const { volver } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <Marca className="self-center" />
      <FormularioDeIngreso volver={destinoSeguro(volver)} />
    </main>
  );
}
