'use client';

import { Car, History, MapPin, Wallet, type LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

export interface Seccion {
  readonly sufijo: string;
  readonly texto: string;
  readonly Icono: LucideIcon;
}

const SECCIONES: readonly Seccion[] = [
  { sufijo: '', texto: 'Estacionar', Icono: MapPin },
  { sufijo: '/saldo', texto: 'Saldo', Icono: Wallet },
  { sufijo: '/vehiculos', texto: 'Vehículos', Icono: Car },
  { sufijo: '/historial', texto: 'Historial', Icono: History },
];

function useSecciones(base: string, secciones: readonly Seccion[]) {
  const ruta = usePathname();
  return secciones.map((seccion) => {
    const destino = `${base}${seccion.sufijo}`;
    return { ...seccion, destino: destino as Route, activa: ruta === destino };
  });
}

/**
 * Barra de pestañas inferior (celular). Sin `secciones`, las del conductor;
 * `base` es la ruta a la que se agrega el sufijo de cada sección.
 */
export function NavegacionInferior({
  municipio,
  base = `/${municipio}`,
  secciones: propias = SECCIONES,
}: {
  municipio: string;
  base?: string;
  secciones?: readonly Seccion[];
}) {
  const secciones = useSecciones(base, propias);
  return (
    <nav
      aria-label="Secciones"
      className="border-t border-borde bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2">
        {secciones.map(({ destino, texto, Icono, activa }) => (
          <li key={texto}>
            <Link
              href={destino}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'group flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold transition-colors',
                activa ? 'text-marca' : 'text-tinta-tenue hover:text-tinta',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-14 place-items-center rounded-full transition-colors',
                  activa ? 'bg-marca-suave' : 'group-hover:bg-superficie-2',
                )}
              >
                <Icono className="size-[1.35rem]" aria-hidden strokeWidth={activa ? 2.4 : 2} />
              </span>
              {texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Pestañas horizontales de la barra superior (escritorio). */
export function NavegacionSuperior({
  municipio,
  base = `/${municipio}`,
  secciones: propias = SECCIONES,
}: {
  municipio: string;
  base?: string;
  secciones?: readonly Seccion[];
}) {
  const secciones = useSecciones(base, propias);
  return (
    <nav aria-label="Secciones">
      <ul className="flex items-center gap-1">
        {secciones.map(({ destino, texto, Icono, activa }) => (
          <li key={texto}>
            <Link
              href={destino}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
                activa
                  ? 'bg-marca-suave text-marca'
                  : 'text-tinta-suave hover:bg-superficie-2 hover:text-tinta',
              )}
            >
              <Icono className="size-[1.1rem]" aria-hidden strokeWidth={activa ? 2.4 : 2} />
              {texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
