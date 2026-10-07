'use client';

import { Car, History, MapPin, Wallet, type LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const SECCIONES: readonly { sufijo: string; texto: string; Icono: LucideIcon }[] = [
  { sufijo: '', texto: 'Estacionar', Icono: MapPin },
  { sufijo: '/saldo', texto: 'Saldo', Icono: Wallet },
  { sufijo: '/vehiculos', texto: 'Vehículos', Icono: Car },
  { sufijo: '/historial', texto: 'Historial', Icono: History },
];

export function Navegacion({ municipio }: { municipio: string }) {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {SECCIONES.map(({ sufijo, texto, Icono }) => {
          const destino = `/${municipio}${sufijo}`;
          const activa = ruta === destino;
          return (
            <li key={texto}>
              <Link
                href={destino as Route}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                  activa ? 'text-marca' : 'text-tinta-suave hover:text-tinta',
                )}
              >
                <Icono className="size-6" aria-hidden strokeWidth={activa ? 2.4 : 1.8} />
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
