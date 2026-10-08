import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { BotonSalir } from '@/componentes/boton-salir';
import { Marca } from '@/componentes/marca';
import { personalActual } from '@/lib/servidor/personal';

export const metadata: Metadata = { title: { default: 'Plataforma', template: '%s · Plataforma' } };

/** Panel del equipo de Parkia: alta y seguimiento de los municipios clientes. */
export default async function LayoutDePlataforma({ children }: { children: ReactNode }) {
  const usuario = await personalActual();
  if (!usuario.administradorDeParkia) redirect('/personal');

  return (
    <div className="min-h-dvh">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:px-8">
          <Link href="/plataforma" className="flex items-center gap-3">
            <Marca />
            <span className="rounded-full bg-tinta px-2 py-0.5 text-[0.65rem] font-bold tracking-widest text-superficie uppercase">
              Plataforma
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-tinta-suave sm:inline">{usuario.email}</span>
            <Link
              href="/personal/contrasena"
              className="hidden text-sm font-semibold text-tinta-suave hover:text-tinta sm:inline"
            >
              Contraseña
            </Link>
            <BotonSalir compacto />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
