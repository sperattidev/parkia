import { cn } from '@/lib/cn';

/** Isotipo de Parkia: una "P" dentro de un marcador de ubicación. */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <path
        d="M16 2C9.9 2 5 6.8 5 12.8c0 7.6 8.6 15.6 10.1 16.9a1.4 1.4 0 0 0 1.8 0C18.4 28.4 27 20.4 27 12.8 27 6.8 22.1 2 16 2Z"
        className="fill-marca"
      />
      <path
        d="M12.5 19.5V7.8h4.6c2.7 0 4.4 1.5 4.4 3.9s-1.7 3.9-4.4 3.9h-1.8v3.9h-2.8Zm2.8-6.2h1.6c1.1 0 1.8-.6 1.8-1.6s-.7-1.6-1.8-1.6h-1.6v3.2Z"
        className="fill-sobre-marca"
      />
    </svg>
  );
}

export function Marca({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Isotipo />
      <span className="text-xl font-bold tracking-tight">Parkia</span>
    </span>
  );
}
