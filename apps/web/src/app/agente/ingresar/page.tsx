import { Radar, ScanLine, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { Marca } from '@/componentes/marca';

import { FormularioDePersonal } from './formulario';

export const metadata: Metadata = { title: 'Control · Ingresar' };

const PUNTOS: readonly { Icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    Icono: ScanLine,
    titulo: 'Padrón de cada cuadra',
    texto: 'Quién pagó, en qué mano y en qué lugar.',
  },
  {
    Icono: Radar,
    titulo: 'Radar de vencidos',
    texto: 'Los vehículos que se quedaron sin saldo, los más cercanos primero.',
  },
  {
    Icono: ShieldCheck,
    titulo: 'Cada control queda registrado',
    texto: 'Con hora, ubicación y resultado, para auditar y labrar actas.',
  },
];

export default function IngresarPersonal() {
  return (
    <main className="grid min-h-dvh bg-[#070c18] text-white lg:grid-cols-[1.1fr_1fr]">
      <section className="relative overflow-hidden px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-24 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(59_107_255/0.35),transparent_55%),radial-gradient(circle_at_90%_90%,rgb(14_159_110/0.18),transparent_50%)]"
          aria-hidden
        />
        <div className="relative">
          <span className="flex items-center gap-3">
            <Marca className="[&_span]:text-white" />
            <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[0.7rem] font-bold tracking-widest uppercase">
              Control
            </span>
          </span>
          <h1 className="mt-8 max-w-md text-3xl leading-[1.1] font-extrabold tracking-tight lg:mt-0 lg:pt-24 lg:text-5xl">
            La ronda de control, cuadra por cuadra.
          </h1>
          <p className="mt-4 max-w-md text-white/70 lg:text-lg">
            Para agentes de tránsito y personal municipal.
          </p>
        </div>

        <ul className="relative mt-10 hidden max-w-md space-y-5 lg:block">
          {PUNTOS.map(({ Icono, titulo, texto }) => (
            <li key={titulo} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 backdrop-blur">
                <Icono className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{titulo}</span>
                <span className="text-sm text-white/65">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative -mt-14 flex justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:px-10">
        <div className="w-full max-w-md text-tinta">
          <FormularioDePersonal />
        </div>
      </section>
    </main>
  );
}
