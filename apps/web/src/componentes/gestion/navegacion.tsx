'use client';

import {
  BarChart3,
  Car,
  ClipboardCheck,
  History,
  MapPinned,
  Settings2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';

const SECCIONES: readonly { sufijo: string; texto: string; Icono: LucideIcon }[] = [
  { sufijo: '', texto: 'Resumen', Icono: BarChart3 },
  { sufijo: '/ocupacion', texto: 'Ocupación', Icono: MapPinned },
  { sufijo: '/estacionamientos', texto: 'Estacionamientos', Icono: Car },
  { sufijo: '/controles', texto: 'Controles', Icono: ClipboardCheck },
  { sufijo: '/zonas', texto: 'Zonas y tarifas', Icono: Settings2 },
  { sufijo: '/personal', texto: 'Personal', Icono: Users },
  { sufijo: '/auditoria', texto: 'Auditoría', Icono: History },
];

/** Las secciones con período lo conservan al navegar (ver `usePeriodo`). */
const CON_PERIODO = new Set(['', '/estacionamientos', '/controles']);

function useSecciones(municipio: string) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const periodo = new URLSearchParams();
  for (const clave of ['desde', 'hasta']) {
    const valor = parametros.get(clave);
    if (valor) periodo.set(clave, valor);
  }
  return SECCIONES.map((seccion) => {
    const base = `/gestion/${municipio}${seccion.sufijo}`;
    const conPeriodo = CON_PERIODO.has(seccion.sufijo) && periodo.size > 0;
    return {
      ...seccion,
      destino: (conPeriodo ? `${base}?${periodo.toString()}` : base) as Route,
      activa: ruta === base,
    };
  });
}

/** Menú lateral (escritorio). */
export function MenuLateral({ municipio }: { municipio: string }) {
  return (
    <nav aria-label="Secciones del panel">
      <ul className="space-y-0.5">
        {useSecciones(municipio).map(({ destino, texto, Icono, activa }) => (
          <li key={texto}>
            <Link
              href={destino}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
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

/** Pestañas desplazables (celular y tablet). */
export function PestanasDeGestion({ municipio }: { municipio: string }) {
  return (
    <nav aria-label="Secciones del panel" className="sin-barra overflow-x-auto">
      <ul className="flex gap-1 px-4 pb-2">
        {useSecciones(municipio).map(({ destino, texto, activa }) => (
          <li key={texto}>
            <Link
              href={destino}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors',
                activa ? 'bg-marca text-sobre-marca' : 'bg-superficie-2 text-tinta-suave',
              )}
            >
              {texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
