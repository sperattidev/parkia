import type { ReactNode } from 'react';

import { Isotipo } from './marca';

export function EncabezadoDePagina({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3">
        <Isotipo className="lg:hidden" />
        <div>
          {subtitulo && (
            <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">
              {subtitulo}
            </p>
          )}
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{titulo}</h1>
        </div>
      </div>
      {accion}
    </header>
  );
}

export function ContenedorDePagina({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl animate-aparecer space-y-6 px-4 pt-6 pb-10 lg:pt-10">
      {children}
    </main>
  );
}
