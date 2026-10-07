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
    <header className="flex items-center justify-between gap-3 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3">
        <Isotipo className="size-9" />
        <div>
          <h1 className="text-2xl font-bold">{titulo}</h1>
          {subtitulo && <p className="text-sm text-tinta-suave">{subtitulo}</p>}
        </div>
      </div>
      {accion}
    </header>
  );
}

export function ContenedorDePagina({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-lg space-y-5 px-4 py-6">{children}</main>;
}
