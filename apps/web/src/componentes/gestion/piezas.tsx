'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { periodosRapidos, type Periodo } from '@/lib/gestion';

import { useGestion } from './contexto';

export function EncabezadoDeSeccion({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-2xl text-sm text-tinta-suave">{descripcion}</p>}
      </div>
      {accion}
    </header>
  );
}

export function ContenidoDeGestion({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl animate-aparecer space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      {children}
    </main>
  );
}

const campoDeFecha =
  'h-10 rounded-xl border border-borde bg-superficie px-3 text-sm font-semibold text-tinta focus:border-marca focus:outline-none';

/** Atajos (hoy, 7 días, 30 días, este mes) y fechas libres. */
export function SelectorDePeriodo({
  periodo,
  alCambiar,
}: {
  periodo: Periodo;
  alCambiar: (periodo: Periodo) => void;
}) {
  const { municipio } = useGestion();
  const rapidos = periodosRapidos(municipio.zonaHoraria);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl bg-superficie-2 p-1" role="group" aria-label="Período">
        {rapidos.map((rapido) => {
          const activo = rapido.desde === periodo.desde && rapido.hasta === periodo.hasta;
          return (
            <button
              key={rapido.clave}
              type="button"
              aria-pressed={activo}
              onClick={() => {
                alCambiar({ desde: rapido.desde, hasta: rapido.hasta });
              }}
              className={cn(
                'h-8 rounded-lg px-3 text-sm font-semibold transition',
                activo
                  ? 'bg-superficie text-tinta shadow-suave'
                  : 'text-tinta-suave hover:text-tinta',
              )}
            >
              {rapido.texto}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm text-tinta-suave">
        <CalendarDays className="size-4" aria-hidden />
        <span className="sr-only">Desde</span>
        <input
          type="date"
          value={periodo.desde}
          max={periodo.hasta}
          onChange={(evento) => {
            if (evento.target.value) alCambiar({ ...periodo, desde: evento.target.value });
          }}
          className={campoDeFecha}
        />
      </label>
      <span className="text-tinta-tenue" aria-hidden>
        –
      </span>
      <label>
        <span className="sr-only">Hasta</span>
        <input
          type="date"
          value={periodo.hasta}
          min={periodo.desde}
          onChange={(evento) => {
            if (evento.target.value) alCambiar({ ...periodo, hasta: evento.target.value });
          }}
          className={campoDeFecha}
        />
      </label>
    </div>
  );
}

export function Indicador({
  etiqueta,
  valor,
  detalle,
  tono,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: 'marca' | 'peligro' | undefined;
}) {
  return (
    <div className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
      <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">{etiqueta}</p>
      <p
        className={cn(
          'cifras mt-2 text-3xl leading-none font-extrabold tracking-tight',
          tono === 'marca' && 'text-marca',
          tono === 'peligro' && 'text-peligro',
        )}
      >
        {valor}
      </p>
      {detalle ? <p className="mt-2 text-sm text-tinta-suave">{detalle}</p> : null}
    </div>
  );
}

export interface Barra {
  readonly clave: string;
  readonly etiqueta: string;
  readonly valor: number;
  /** Texto completo para el lector de pantalla y el globo al pasar el mouse. */
  readonly descripcion: string;
}

/**
 * Gráfico de barras liviano (sin librería): accesible, con el valor de cada
 * barra al pasar el mouse o al enfocarla con el teclado.
 */
export function GraficoDeBarras({
  barras,
  alto = 180,
  etiquetasCada = 1,
  resaltar,
}: {
  barras: readonly Barra[];
  alto?: number;
  /** Muestra una etiqueta cada tantas barras (para series largas). */
  etiquetasCada?: number;
  resaltar?: (barra: Barra) => boolean;
}) {
  const maximo = Math.max(...barras.map((b) => b.valor), 1);
  return (
    <figure>
      <div className="flex items-end gap-[3px]" style={{ height: alto }} role="list">
        {barras.map((barra) => (
          <div
            key={barra.clave}
            role="listitem"
            tabIndex={0}
            title={barra.descripcion}
            aria-label={barra.descripcion}
            className="group relative flex h-full min-w-0 flex-1 items-end focus:outline-none"
          >
            <span
              className={cn(
                'block w-full rounded-t-md transition-colors',
                resaltar?.(barra) ? 'bg-marca' : 'bg-marca/45',
                'group-hover:bg-marca-fuerte group-focus:bg-marca-fuerte',
              )}
              style={{
                height: `${String(Math.max((barra.valor / maximo) * 100, barra.valor > 0 ? 2 : 0.5))}%`,
              }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-tinta px-2 py-1 text-xs font-semibold whitespace-nowrap text-superficie group-hover:block group-focus:block">
              {barra.descripcion}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {barras.map((barra, i) => (
          <span
            key={barra.clave}
            className="min-w-0 flex-1 truncate text-center text-[0.65rem] text-tinta-tenue"
          >
            {i % etiquetasCada === 0 ? barra.etiqueta : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function Paginacion({
  pagina,
  porPagina,
  total,
  alCambiar,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  alCambiar: (pagina: number) => void;
}) {
  const paginas = Math.max(Math.ceil(total / porPagina), 1);
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm text-tinta-suave">
      <p className="cifras">
        {desde}–{hasta} de {total.toLocaleString('es-AR')}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={pagina <= 1}
          onClick={() => {
            alCambiar(pagina - 1);
          }}
          className="grid size-9 place-items-center rounded-xl border border-borde bg-superficie transition hover:bg-superficie-2 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Página siguiente"
          disabled={pagina >= paginas}
          onClick={() => {
            alCambiar(pagina + 1);
          }}
          className="grid size-9 place-items-center rounded-xl border border-borde bg-superficie transition hover:bg-superficie-2 disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function BotonExportar({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-borde-fuerte bg-superficie px-4 text-sm font-semibold transition hover:bg-superficie-2"
    >
      <Download className="size-4" aria-hidden /> Exportar a Excel
    </a>
  );
}

/** Contenedor de tabla con desplazamiento horizontal en pantallas chicas. */
export function MarcoDeTabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
      <table className="w-full min-w-[44rem] text-left text-sm">{children}</table>
    </div>
  );
}

export const celdaDeEncabezado =
  'border-b border-borde px-4 py-3 text-xs font-bold tracking-wider text-tinta-tenue uppercase';
export const celda = 'border-b border-borde px-4 py-3 align-middle';
