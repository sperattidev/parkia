'use client';

import type { ResultadoDeControl } from '@parkia/contracts';
import { ClipboardList } from 'lucide-react';
import type { ReactNode } from 'react';

import { patenteLegible } from '@/componentes/placa';
import { EstadoVacio, Esqueleto, Etiqueta, TituloDeSeccion } from '@/componentes/ui';
import { useJornada } from '@/lib/agente';
import { cn } from '@/lib/cn';
import { hora } from '@/lib/formato';

import { TEXTOS_DE_RESULTADO, TONOS_DE_RESULTADO } from './piezas';
import { useRonda } from './ronda';

const ORDEN: readonly ResultadoDeControl[] = [
  'habilitado',
  'fuera_de_horario',
  'vencido',
  'sin_estacionamiento',
  'otra_zona',
  'fuera_de_zona',
];

const BARRAS = { exito: 'bg-exito', peligro: 'bg-peligro', neutro: 'bg-tinta-tenue' } as const;

function Indicador({
  etiqueta,
  valor,
  detalle,
  tono,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: string;
  tono?: 'peligro';
}) {
  return (
    <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
      <p className="text-xs font-semibold text-tinta-tenue">{etiqueta}</p>
      <p
        className={cn(
          'cifras mt-1 text-3xl leading-none font-extrabold tracking-tight',
          tono === 'peligro' && 'text-peligro',
        )}
      >
        {valor}
      </p>
      {detalle && <p className="mt-1.5 text-xs text-tinta-suave">{detalle}</p>}
    </div>
  );
}

/** Resumen del día: lo que el agente rinde al terminar el turno. */
export function PantallaJornada() {
  const { municipio, mapa } = useRonda();
  const jornada = useJornada(municipio.slug);

  if (!jornada.data) {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 pt-5" aria-busy>
        <Esqueleto className="h-9 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Esqueleto className="h-24 rounded-tarjeta" />
          <Esqueleto className="h-24 rounded-tarjeta" />
        </div>
      </main>
    );
  }

  const { controles, infracciones, porResultado, ultimos, cobertura } = jornada.data;
  const total = mapa.cuadras.features.length;
  const evaluados = controles - porResultado.fuera_de_zona;
  const cumplimiento =
    evaluados > 0 ? Math.round(((evaluados - infracciones) / evaluados) * 100) : null;

  return (
    <main className="mx-auto w-full max-w-xl animate-aparecer space-y-6 px-4 pt-5 pb-10">
      <header>
        <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">Hoy</p>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">Tu jornada</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Indicador etiqueta="Controles" valor={controles} />
        <Indicador
          etiqueta="Infracciones"
          valor={infracciones}
          {...(infracciones > 0 && { tono: 'peligro' as const })}
          detalle="sin pago, vencidos u otra zona"
        />
        <Indicador
          etiqueta="En regla"
          valor={cumplimiento === null ? '—' : `${String(cumplimiento)}%`}
          detalle="de los vehículos controlados"
        />
        <Indicador
          etiqueta="Cobertura del equipo"
          valor={`${String(cobertura.length)}/${String(total)}`}
          detalle="cuadras controladas hoy"
        />
      </div>

      {controles === 0 ? (
        <EstadoVacio
          Icono={ClipboardList}
          titulo="Todavía no controlaste"
          descripcion="Tus controles de hoy y su resultado aparecen acá."
        />
      ) : (
        <>
          <section>
            <TituloDeSeccion>Por resultado</TituloDeSeccion>
            <ul className="space-y-2.5 rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
              {ORDEN.filter((r) => porResultado[r] > 0).map((resultado) => (
                <li key={resultado}>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{TEXTOS_DE_RESULTADO[resultado]}</span>
                    <span className="cifras">{porResultado[resultado]}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-superficie-2">
                    <div
                      className={cn('h-full rounded-full', BARRAS[TONOS_DE_RESULTADO[resultado]])}
                      style={{ width: `${String((porResultado[resultado] / controles) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <TituloDeSeccion>Últimos controles</TituloDeSeccion>
            <ul className="divide-y divide-borde rounded-tarjeta bg-superficie shadow-tarjeta">
              {ultimos.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="font-mono text-[0.95rem] font-bold tracking-wider">
                    {patenteLegible(c.patente)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-tinta-tenue">
                    {c.calle ?? 'Fuera de zona'} · {hora(c.registradoEn, municipio.zonaHoraria)}
                  </span>
                  <Etiqueta tono={TONOS_DE_RESULTADO[c.resultado]}>
                    {TEXTOS_DE_RESULTADO[c.resultado]}
                  </Etiqueta>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
