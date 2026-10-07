import { LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const VARIANTES = {
  primario:
    'bg-marca text-sobre-marca shadow-marca hover:bg-marca-fuerte active:shadow-none disabled:shadow-none',
  secundario: 'bg-superficie-2 text-tinta hover:bg-borde',
  contorno: 'border border-borde-fuerte bg-superficie text-tinta hover:bg-superficie-2',
  peligro: 'bg-peligro text-white hover:brightness-110',
  fantasma: 'text-marca hover:bg-marca-suave',
} as const;

const TAMANOS = {
  grande: 'h-14 px-6 text-base',
  normal: 'h-12 px-5 text-[0.95rem]',
  chico: 'h-9 px-3.5 text-sm',
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
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-tight',
        'transition duration-150 select-none active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
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
      className={cn('rounded-tarjeta bg-superficie p-5 shadow-tarjeta', className)}
      {...props}
    />
  );
}

const TONOS = {
  neutro: 'bg-superficie-2 text-tinta-suave',
  exito: 'bg-exito-suave text-exito',
  alerta: 'bg-alerta-suave text-[#a35f00] dark:text-alerta',
  peligro: 'bg-peligro-suave text-peligro',
  marca: 'bg-marca-suave text-marca',
} as const;

export function Etiqueta({
  tono = 'neutro',
  punto = false,
  children,
  className,
}: {
  tono?: keyof typeof TONOS;
  punto?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        TONOS[tono],
        className,
      )}
    >
      {punto && <span className="size-1.5 animate-latido rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function CampoDeTexto({
  etiqueta,
  ayuda,
  error,
  className,
  id,
  ...props
}: ComponentProps<'input'> & {
  etiqueta: string;
  ayuda?: string | undefined;
  error?: string | undefined;
}) {
  const idCampo = id ?? props.name;
  return (
    <label htmlFor={idCampo} className="block">
      <span className="mb-1.5 block text-sm font-semibold">{etiqueta}</span>
      <input
        id={idCampo}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-13 w-full rounded-control border border-borde bg-superficie px-4 text-base text-tinta shadow-suave',
          'transition placeholder:text-tinta-tenue focus:border-marca focus:ring-4 focus:ring-marca/15 focus:outline-none',
          error && 'border-peligro focus:border-peligro focus:ring-peligro/15',
          className,
        )}
        {...props}
      />
      {error ? (
        <span className="mt-1.5 block text-sm text-peligro">{error}</span>
      ) : (
        ayuda && <span className="mt-1.5 block text-sm text-tinta-suave">{ayuda}</span>
      )}
    </label>
  );
}

/** Marcador de contenido mientras carga: conserva la forma de lo que va a aparecer. */
export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-superficie-2', className)} aria-hidden />;
}

export function EstadoVacio({
  Icono,
  titulo,
  descripcion,
  accion,
}: {
  Icono: LucideIcon;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-marca-suave text-marca">
        <Icono className="size-7" aria-hidden />
      </span>
      <p className="text-base font-bold">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-xs text-sm text-tinta-suave">{descripcion}</p>}
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  );
}

export function TituloDeSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">{children}</h2>
      {accion}
    </div>
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
