import type { MunicipioPublico, ZonaResumen } from '@parkia/contracts';
import { BellRing, Coins, Smartphone, type LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { TarifaDeZona } from './resumen-de-zona';

const BENEFICIOS: readonly { Icono: LucideIcon; texto: string }[] = [
  { Icono: Coins, texto: 'Pagás solo los minutos que usás' },
  { Icono: BellRing, texto: 'Te avisamos antes de que venza' },
  { Icono: Smartphone, texto: 'Sin tickets, tarjetas ni monedas' },
];

export function HojaSinSesion({
  municipio,
  zona,
}: {
  municipio: MunicipioPublico;
  /** Zona de la cuadra tocada o, si no, la primera del municipio. */
  zona: ZonaResumen | undefined;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-wider text-marca uppercase">
          Estacionamiento medido · {municipio.nombre}
        </p>
        <h1 className="mt-1.5 text-2xl leading-tight font-extrabold tracking-tight">
          Estacioná desde el celular
        </h1>
      </div>

      <ul className="space-y-3">
        {BENEFICIOS.map(({ Icono, texto }) => (
          <li key={texto} className="flex items-center gap-3 text-[0.95rem] font-medium">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-marca-suave text-marca">
              <Icono className="size-[1.1rem]" aria-hidden />
            </span>
            {texto}
          </li>
        ))}
      </ul>

      {zona && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: zona.color }}
              aria-hidden
            />
            {zona.nombre}
          </p>
          <TarifaDeZona zona={zona} />
        </div>
      )}

      <Link
        href={`/ingresar?volver=/${municipio.slug}` as Route}
        className="flex h-14 items-center justify-center rounded-control bg-marca text-base font-bold text-sobre-marca shadow-marca transition hover:bg-marca-fuerte active:scale-[0.98]"
      >
        Ingresar con mi email
      </Link>
      <p className="text-center text-xs text-tinta-tenue">
        Sin contraseñas: te enviamos un código para entrar.
      </p>
    </div>
  );
}
