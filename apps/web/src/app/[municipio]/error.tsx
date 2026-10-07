'use client';

import { RefreshCw, WifiOff } from 'lucide-react';

import { Boton } from '@/componentes/ui';

/** Falla al consultar la API (caída, sin conexión): se ofrece reintentar. */
export default function ErrorDeMunicipio({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center gap-5 px-5 text-center">
      <WifiOff className="size-12 text-tinta-suave" aria-hidden />
      <div>
        <h1 className="text-2xl font-bold">No pudimos cargar Parkia</h1>
        <p className="mt-2 text-tinta-suave">
          El servicio no está respondiendo. Probá de nuevo en unos segundos.
        </p>
      </div>
      <Boton onClick={reset}>
        <RefreshCw className="size-5" aria-hidden /> Reintentar
      </Boton>
    </main>
  );
}
