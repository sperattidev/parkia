import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Contenedor de la hoja: inferior en el celular, panel lateral en escritorio.
 * `compacta` deja más mapa a la vista en el celular.
 */
export function Hoja({ children, compacta = false }: { children: ReactNode; compacta?: boolean }) {
  return (
    <aside className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex max-h-full flex-col justify-end lg:inset-y-5 lg:right-auto lg:left-5 lg:w-[26rem] lg:justify-start">
      <div
        className={cn(
          'pointer-events-auto animate-subir overflow-y-auto rounded-t-[1.75rem] bg-superficie shadow-flotante lg:max-h-full lg:rounded-tarjeta',
          compacta ? 'max-h-[58%]' : 'max-h-[calc(100%-5rem)]',
        )}
      >
        <div className="sticky top-0 flex justify-center bg-superficie pt-2.5 pb-1 lg:hidden">
          <span className="h-1.5 w-10 rounded-full bg-borde-fuerte" aria-hidden />
        </div>
        <div className="px-5 pt-2 pb-5 lg:p-6">{children}</div>
      </div>
    </aside>
  );
}
