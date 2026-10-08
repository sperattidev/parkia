'use client';

import type { Coincidencia, Control } from '@parkia/contracts';
import { CircleCheck, CircleSlash, History, MapPin, OctagonAlert } from 'lucide-react';

import { Placa } from '@/componentes/placa';
import { Etiqueta } from '@/componentes/ui';
import { cn } from '@/lib/cn';
import { hora } from '@/lib/formato';

import { hace, TEXTOS_DE_RESULTADO } from './piezas';
import { useRonda } from './ronda';

const COINCIDENCIAS: Record<Coincidencia, { texto: string; tono: 'exito' | 'alerta' | 'peligro' }> =
  {
    misma_cuadra: { texto: 'En la cuadra que declaró', tono: 'exito' },
    cuadra_cercana: { texto: 'Declaró una cuadra vecina', tono: 'alerta' },
    otra_cuadra: { texto: 'Declaró otra cuadra', tono: 'peligro' },
  };

/** Explicación en una línea de por qué el vehículo está (o no) habilitado. */
function motivo(control: Control, zonaHoraria: string, ahora: Date): string {
  const { estacionamiento } = control;
  switch (control.resultado) {
    case 'habilitado':
      return estacionamiento
        ? `Pagado hasta las ${hora(estacionamiento.venceEn, zonaHoraria)}.`
        : 'Pagado.';
    case 'fuera_de_horario':
      return 'En este momento no se cobra en esta zona.';
    case 'vencido':
      return estacionamiento
        ? `Se le agotó el saldo ${hace(estacionamiento.venceEn, ahora, zonaHoraria)} y no volvió a pagar.`
        : 'Se le agotó el saldo.';
    case 'otra_zona':
      return `Pagó en ${estacionamiento?.zona.nombre ?? 'otra zona'}, no en esta.`;
    case 'sin_estacionamiento':
      return 'No tiene un estacionamiento pago hoy.';
    case 'fuera_de_zona':
      return 'Tu ubicación no está sobre una cuadra con estacionamiento medido.';
  }
}

/**
 * Resultado del control, legible a un metro y a pleno sol: color de fondo,
 * ícono y una frase. Abajo, el detalle para decidir si corresponde un acta.
 */
export function Veredicto({ control }: { control: Control }) {
  const { municipio } = useRonda();
  const ahora = new Date(control.registradoEn);
  const neutro = control.resultado === 'fuera_de_zona';
  const Icono = neutro ? CircleSlash : control.habilitado ? CircleCheck : OctagonAlert;
  const { estacionamiento, controlAnterior } = control;

  return (
    <article className="animate-subir overflow-hidden rounded-tarjeta bg-superficie shadow-flotante">
      <header
        role="status"
        className={cn(
          'flex items-center gap-4 px-5 py-5 text-white',
          neutro ? 'bg-tinta-suave' : control.habilitado ? 'bg-exito' : 'bg-peligro',
        )}
      >
        <Icono className="size-12 shrink-0" strokeWidth={2.2} aria-hidden />
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold tracking-widest uppercase opacity-85">
            {neutro ? 'Sin evaluar' : control.habilitado ? 'Habilitado' : 'Infracción'}
          </p>
          <p className="text-2xl leading-tight font-extrabold">
            {TEXTOS_DE_RESULTADO[control.resultado]}
          </p>
        </div>
      </header>

      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <Placa patente={control.patente} tamano="grande" />
          <p className="text-right text-xs font-semibold text-tinta-tenue">
            Registrado
            <br />
            {hora(control.registradoEn, municipio.zonaHoraria)}
          </p>
        </div>

        <p className="text-[0.95rem] leading-snug font-semibold">
          {motivo(control, municipio.zonaHoraria, ahora)}
        </p>

        {estacionamiento?.ubicacion && (
          <div className="rounded-control bg-superficie-2 p-3.5">
            <p className="text-xs font-semibold text-tinta-tenue">El conductor declaró</p>
            <p className="mt-0.5 flex items-center gap-1.5 font-bold">
              <MapPin className="size-4 shrink-0 text-marca" aria-hidden />
              {estacionamiento.ubicacion.direccion}
            </p>
            {estacionamiento.coincidencia && (
              <Etiqueta tono={COINCIDENCIAS[estacionamiento.coincidencia].tono} className="mt-2">
                {COINCIDENCIAS[estacionamiento.coincidencia].texto}
              </Etiqueta>
            )}
          </div>
        )}

        {control.cuadra && (
          <p className="text-xs text-tinta-tenue">
            Controlado en {control.cuadra.calle} {control.cuadra.alturaDesde}–
            {control.cuadra.alturaHasta}
            {control.zona && ` · ${control.zona.nombre}`}
          </p>
        )}

        {controlAnterior && (
          <p className="flex gap-2 rounded-control bg-alerta-suave p-3 text-sm leading-snug font-medium">
            <History className="size-5 shrink-0 text-alerta" aria-hidden />
            Ya se controló {hace(controlAnterior.registradoEn, ahora, municipio.zonaHoraria)}:{' '}
            {TEXTOS_DE_RESULTADO[controlAnterior.resultado].toLowerCase()}.
          </p>
        )}
      </div>
    </article>
  );
}
