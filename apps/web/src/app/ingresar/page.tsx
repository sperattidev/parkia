import { BellRing, Coins, MapPinned, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { Marca } from '@/componentes/marca';

import { FormularioDeIngreso } from './formulario';

export const metadata: Metadata = { title: 'Ingresar' };

const PUNTOS: readonly { Icono: LucideIcon; titulo: string; texto: string }[] = [
  { Icono: MapPinned, titulo: 'Estacioná en segundos', texto: 'Elegí tu patente y listo.' },
  { Icono: Coins, titulo: 'Pagá lo justo', texto: 'Se cobra solo el tiempo que usás.' },
  { Icono: BellRing, titulo: 'Sin sorpresas', texto: 'Te avisamos antes de que venza.' },
];

/** Solo se aceptan rutas internas como destino, para evitar redirecciones abiertas. */
function destinoSeguro(volver: string | string[] | undefined): string {
  return typeof volver === 'string' && /^\/[a-z0-9/-]*$/.test(volver) ? volver : '/';
}

export default async function Ingresar({ searchParams }: PageProps<'/ingresar'>) {
  const { volver } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2a7a] via-[#1b3fc0] to-[#3b6bff] px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-24 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/5" aria-hidden />

        <div className="relative">
          <Marca className="[&_span]:text-white" />
          <h1 className="mt-8 max-w-md text-3xl leading-[1.1] font-extrabold tracking-tight lg:mt-0 lg:pt-24 lg:text-5xl">
            Estacionamiento medido, sin tickets ni monedas.
          </h1>
          <p className="mt-4 max-w-md text-white/80 lg:text-lg">
            Pagás desde el celular y solo por el tiempo que usás.
          </p>
        </div>

        <ul className="relative mt-10 hidden max-w-md space-y-5 lg:block">
          {PUNTOS.map(({ Icono, titulo, texto }) => (
            <li key={titulo} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <Icono className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{titulo}</span>
                <span className="text-sm text-white/75">{texto}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="relative mt-10 hidden items-center gap-2 text-sm text-white/70 lg:flex">
          <ShieldCheck className="size-4" aria-hidden /> Tus datos se usan solo para gestionar tu
          estacionamiento.
        </p>
      </section>

      <section className="relative -mt-14 flex justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:px-10">
        <div className="w-full max-w-md">
          <FormularioDeIngreso volver={destinoSeguro(volver)} />
        </div>
      </section>
    </main>
  );
}
