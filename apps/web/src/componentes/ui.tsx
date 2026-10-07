import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const VARIANTES = {
  primario: 'bg-marca text-sobre-marca hover:bg-marca-fuerte shadow-sm',
  secundario: 'bg-superficie-2 text-tinta hover:bg-borde',
  peligro: 'bg-peligro text-white hover:opacity-90',
  fantasma: 'text-marca hover:bg-marca-suave',
} as const;

const TAMANOS = {
  normal: 'h-12 px-5 text-base',
  chico: 'h-9 px-3 text-sm',
} as const;

export interface BotonProps extends ComponentProps<'button'> {
  variante?: keyof typeof VARIANTES;
  tamano?: keyof typeof TAMANOS;
  cargando?: boolean;
}

export function Boton({
  variante = 'primario',
  tamano = 'normal',
  cargando = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: BotonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? cargando}
      aria-busy={cargando}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]',
        VARIANTES[variante],
        TAMANOS[tamano],
        className,
      )}
      {...props}
    >
      {cargando && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Tarjeta({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-tarjeta border border-borde bg-superficie p-5', className)}
      {...props}
    />
  );
}

export function Etiqueta({
  tono = 'neutro',
  children,
}: {
  tono?: 'neutro' | 'exito' | 'alerta' | 'peligro' | 'marca';
  children: ReactNode;
}) {
  const tonos = {
    neutro: 'bg-superficie-2 text-tinta-suave',
    exito: 'bg-exito-suave text-exito',
    alerta: 'bg-alerta-suave text-tinta',
    peligro: 'bg-peligro-suave text-peligro',
    marca: 'bg-marca-suave text-marca',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tonos[tono],
      )}
    >
      {children}
    </span>
  );
}

export function CampoDeTexto({
  etiqueta,
  error,
  className,
  id,
  ...props
}: ComponentProps<'input'> & { etiqueta: string; error?: string | undefined }) {
  const idCampo = id ?? props.name;
  return (
    <label htmlFor={idCampo} className="block">
      <span className="mb-1.5 block text-sm font-medium text-tinta-suave">{etiqueta}</span>
      <input
        id={idCampo}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-12 w-full rounded-xl border border-borde bg-superficie px-4 text-base text-tinta',
          'placeholder:text-tinta-suave/60 focus:border-marca focus:outline-none',
          error && 'border-peligro',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1.5 block text-sm text-peligro">{error}</span>}
    </label>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-tinta-suave">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}
