import { useId } from 'react';

import { cn } from '@/lib/cn';

/** Isotipo de Parkia: una "P" sobre un marcador de ubicación, en un cuadrado redondeado. */
export function Isotipo({ className }: { className?: string | undefined }) {
  // Un id por instancia: si la primera copia del degradadoId queda en un elemento
  // oculto (por ejemplo, la barra de escritorio en el celular), las demás no lo verían.
  const degradadoId = useId();
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('size-9 shrink-0', className)}>
      <defs>
        <linearGradient id={degradadoId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b6bff" />
          <stop offset="1" stopColor="#1b3fc0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${degradadoId})`} />
      <path
        d="M20 8.5c-5.2 0-9.4 4.1-9.4 9.2 0 6.4 7.2 13 8.6 14.2a1.2 1.2 0 0 0 1.6 0c1.4-1.2 8.6-7.8 8.6-14.2 0-5.1-4.2-9.2-9.4-9.2Z"
        fill="#fff"
      />
      <path
        d="M17.1 23.5v-11h4.3c2.5 0 4.1 1.4 4.1 3.6s-1.6 3.6-4.1 3.6h-1.7v3.8h-2.6Zm2.6-6h1.5c1 0 1.7-.5 1.7-1.4s-.7-1.4-1.7-1.4h-1.5v2.8Z"
        fill="#2754e6"
      />
    </svg>
  );
}

export function Marca({
  className,
  tamano = 'normal',
}: {
  className?: string;
  tamano?: 'normal' | 'grande';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Isotipo className={tamano === 'grande' ? 'size-11' : undefined} />
      <span
        className={cn(
          'font-extrabold tracking-tight',
          tamano === 'grande' ? 'text-3xl' : 'text-xl',
        )}
      >
        Parkia
      </span>
    </span>
  );
}
