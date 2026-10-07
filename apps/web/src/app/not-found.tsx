import Link from 'next/link';

import { Marca } from '@/componentes/marca';

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-5 text-center">
      <Marca />
      <div>
        <h1 className="text-2xl font-bold">No encontramos esta página</h1>
        <p className="mt-2 text-tinta-suave">Puede que el enlace esté mal o que ya no exista.</p>
      </div>
      <Link href="/" className="font-semibold text-marca">
        Ir al inicio
      </Link>
    </main>
  );
}
