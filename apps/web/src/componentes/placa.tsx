import { cn } from '@/lib/cn';

/** Patente con el aspecto de la placa Mercosur (franja azul superior). */
export function Placa({ patente, className }: { patente: string; className?: string }) {
  const legible =
    patente.length === 7
      ? `${patente.slice(0, 2)} ${patente.slice(2, 5)} ${patente.slice(5)}`
      : patente;
  return (
    <span
      className={cn(
        'inline-flex flex-col overflow-hidden rounded-md border-2 border-tinta bg-white text-center',
        className,
      )}
    >
      <span className="bg-[#1f3c88] px-2 text-[0.5rem] leading-3 font-bold tracking-widest text-white">
        REPÚBLICA ARGENTINA
      </span>
      <span className="px-3 py-0.5 font-mono text-xl font-bold tracking-wider text-black">
        {legible}
      </span>
    </span>
  );
}
