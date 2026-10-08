'use client';

import type { Control } from '@parkia/contracts';
import {
  esPatenteValida,
  formatoDePatente,
  normalizarPatente,
  type FormatoPatente,
} from '@parkia/domain';
import { MapPin, RotateCcw, ScanLine } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { patenteLegible } from '@/componentes/placa';
import { Boton, Etiqueta, TituloDeSeccion } from '@/componentes/ui';
import { useControlar, useJornada } from '@/lib/agente';
import { mensajeDeError } from '@/lib/cliente';
import { cn } from '@/lib/cn';
import { hora } from '@/lib/formato';
import { puntoMedio } from '@/lib/geo';
import { useUbicacionEnCuadra } from '@/lib/hooks';

import { EstadoDelGps, TEXTOS_DE_RESULTADO, TONOS_DE_RESULTADO } from './piezas';
import { useRonda } from './ronda';
import { Veredicto } from './veredicto';

/** Vibración distinta para habilitado e infracción: el agente no necesita mirar. */
function vibrar(control: Control) {
  if (!('vibrate' in navigator)) return;
  navigator.vibrate(control.habilitado ? 60 : [180, 90, 180]);
}

const FORMATOS: Record<FormatoPatente, string> = {
  'auto-mercosur': 'Auto · Mercosur',
  'auto-1995': 'Auto · formato 1995',
  'moto-mercosur': 'Moto · Mercosur',
  'moto-1995': 'Moto · formato 1995',
};

export function PantallaControlar() {
  const { municipio, mapa, posicion } = useRonda();
  const parametros = useSearchParams();
  const cuadraElegida = parametros.get('cuadra') ?? undefined;
  const [patente, setPatente] = useState(parametros.get('patente') ?? '');
  const [ultimo, setUltimo] = useState<Control>();
  const entradaRef = useRef<HTMLInputElement>(null);
  const resultadoRef = useRef<HTMLElement>(null);

  const controlar = useControlar(municipio.slug);
  const jornada = useJornada(municipio.slug);
  const detectada = useUbicacionEnCuadra(municipio.slug, posicion);

  const cuadraId = cuadraElegida ?? detectada.data?.cuadra.id;
  const cuadra = mapa.cuadras.features.find((c) => c.id === cuadraId);
  const valida = esPatenteValida(patente);
  const formato = valida ? formatoDePatente(normalizarPatente(patente)) : null;
  // Sin GPS se puede controlar en una cuadra elegida: se registra su centro, sin precisión.
  const sinUbicacion = !posicion && !cuadra;

  const enviar = () => {
    if (!valida || controlar.isPending || sinUbicacion) return;
    const [lng, lat] = cuadra && !posicion ? puntoMedio(cuadra.geometry.coordinates) : [0, 0];
    controlar.mutate(
      {
        patente: normalizarPatente(patente),
        ...(posicion
          ? { lat: posicion.lat, lng: posicion.lng, precisionMetros: posicion.precision }
          : { lat, lng }),
        ...(cuadraElegida && { cuadraId: cuadraElegida }),
      },
      {
        onSuccess: (control) => {
          vibrar(control);
          setUltimo(control);
          setPatente('');
          // En el celular el resultado queda debajo del teclado: se lo trae a la vista.
          requestAnimationFrame(() => {
            resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        },
        onError: (error) => toast.error(mensajeDeError(error)),
      },
    );
  };

  return (
    <main className="mx-auto w-full max-w-xl animate-aparecer space-y-5 px-4 pt-5 pb-10">
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar();
        }}
        className="space-y-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-tinta-suave">
            <MapPin className="size-4 shrink-0 text-marca" aria-hidden />
            <span className="truncate">
              {cuadra
                ? `${cuadra.properties.calle} ${String(cuadra.properties.alturaDesde)}–${String(cuadra.properties.alturaHasta)}`
                : 'Fuera de las cuadras pagas'}
            </span>
          </p>
          <EstadoDelGps />
        </div>

        <label className="block">
          <span className="sr-only">Patente</span>
          <input
            ref={entradaRef}
            value={patente}
            onChange={(evento) => {
              setPatente(evento.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, ''));
            }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={10}
            placeholder="AB 123 CD"
            aria-describedby="formato-patente"
            className={cn(
              'h-20 w-full rounded-control border-2 bg-white text-center font-mono text-4xl font-bold tracking-[0.15em] text-[#111827] uppercase shadow-suave',
              'placeholder:text-[#c4cad6] focus:outline-none',
              valida ? 'border-marca' : 'border-[#1d2433]',
            )}
          />
        </label>
        <p id="formato-patente" className="h-5 text-center text-sm">
          {formato ? (
            <Etiqueta tono="marca">{FORMATOS[formato]}</Etiqueta>
          ) : patente.length > 0 ? (
            <span className="text-tinta-tenue">AB 123 CD o ABC 123</span>
          ) : null}
        </p>

        <Boton
          type="submit"
          tamano="grande"
          className="w-full"
          disabled={!valida || sinUbicacion}
          cargando={controlar.isPending}
        >
          <ScanLine className="size-5" aria-hidden />
          {sinUbicacion ? 'Esperando GPS…' : 'Controlar'}
        </Boton>
      </form>

      {ultimo && (
        <section ref={resultadoRef} className="scroll-mt-4 space-y-3">
          <Veredicto control={ultimo} />
          <Boton
            variante="secundario"
            className="w-full"
            onClick={() => {
              setUltimo(undefined);
              entradaRef.current?.focus();
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> Controlar otra patente
          </Boton>
        </section>
      )}

      {jornada.data && jornada.data.ultimos.length > 0 && (
        <section>
          <TituloDeSeccion>Tus últimos controles</TituloDeSeccion>
          <ul className="divide-y divide-borde rounded-tarjeta bg-superficie shadow-tarjeta">
            {jornada.data.ultimos.slice(0, 6).map((c) => (
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
      )}
    </main>
  );
}
