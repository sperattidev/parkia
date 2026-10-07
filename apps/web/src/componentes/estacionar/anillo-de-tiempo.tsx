import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

const RADIO = 54;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * Anillo que se vacía a medida que se consume el tiempo cubierto por el saldo.
 * `proporcion` va de 1 (recién iniciado) a 0 (vencido).
 */
export function AnilloDeTiempo({
  proporcion,
  tono,
  children,
}: {
  proporcion: number;
  tono: 'marca' | 'alerta' | 'peligro';
  children: ReactNode;
}) {
  const acotada = Math.min(1, Math.max(0, proporcion));
  const colores = { marca: 'text-marca', alerta: 'text-alerta', peligro: 'text-peligro' };
  return (
    <div className="relative grid size-44 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={RADIO}
          fill="none"
          strokeWidth="9"
          className="stroke-superficie-2"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIO}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - acotada)}
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', colores[tono])}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
