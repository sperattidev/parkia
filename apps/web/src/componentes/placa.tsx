import { cn } from '@/lib/cn';

/** `AE482KT` → `AE 482 KT`, `OKZ715` → `OKZ 715`. */
export function patenteLegible(patente: string): string {
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(patente)) {
    return `${patente.slice(0, 2)} ${patente.slice(2, 5)} ${patente.slice(5)}`;
  }
  if (/^[A-Z]{3}\d{3}$/.test(patente)) return `${patente.slice(0, 3)} ${patente.slice(3)}`;
  return patente;
}

const TAMANOS = {
  chica: { franja: 'h-1.5', texto: 'px-2 py-0.5 text-sm', borde: 'rounded-md border-[1.5px]' },
  normal: { franja: 'h-2.5', texto: 'px-3 py-1 text-lg', borde: 'rounded-lg border-2' },
  grande: { franja: 'h-3.5', texto: 'px-4 py-1.5 text-2xl', borde: 'rounded-xl border-2' },
} as const;

/** Patente con el aspecto de la placa Mercosur (franja azul superior). */
export function Placa({
  patente,
  tamano = 'normal',
  className,
}: {
  patente: string;
  tamano?: keyof typeof TAMANOS;
  className?: string;
}) {
  const t = TAMANOS[tamano];
  return (
    <span
      className={cn(
        'inline-flex flex-col overflow-hidden border-[#1d2433] bg-white shadow-suave',
        t.borde,
        className,
      )}
    >
      <span className={cn('bg-[#1f3c88]', t.franja)} aria-hidden />
      <span
        className={cn(
          'font-mono font-bold tracking-[0.12em] whitespace-nowrap text-[#111827]',
          t.texto,
        )}
      >
        {patenteLegible(patente)}
      </span>
    </span>
  );
}
