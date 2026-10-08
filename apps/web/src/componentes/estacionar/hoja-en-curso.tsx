'use client';

import type { Estacionamiento, MunicipioPublico } from '@parkia/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Placa } from '@/componentes/placa';
import { Boton, Etiqueta } from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';
import { duracion, hora, horaConDia } from '@/lib/formato';
import { claves, useAhora } from '@/lib/hooks';

import { AnilloDeTiempo } from './anillo-de-tiempo';

/** Con menos de este margen se sugiere cargar saldo. */
const AVISO_MS = 10 * 60_000;

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="rounded-control bg-superficie-2 px-3 py-2.5">
      <dt className="text-[0.7rem] font-semibold text-tinta-tenue">{etiqueta}</dt>
      <dd className="cifras mt-0.5 truncate text-[0.95rem] font-bold">{children}</dd>
    </div>
  );
}

/** Texto central del anillo: lo que más le importa al conductor es cuánto le queda. */
function TiempoRestante({
  restante,
  venceEn,
  ahora,
  zonaHoraria,
}: {
  restante: number;
  venceEn: string;
  ahora: Date;
  zonaHoraria: string;
}) {
  if (restante <= 0) {
    return (
      <>
        <p className="text-2xl font-extrabold text-peligro">Vencido</p>
        <p className="text-xs font-semibold text-tinta-suave">
          desde las {hora(venceEn, zonaHoraria)}
        </p>
      </>
    );
  }
  if (restante > 12 * 60 * 60_000) {
    return (
      <>
        <p className="text-xs font-semibold text-tinta-suave">Cubierto hasta</p>
        <p className="cifras text-xl leading-tight font-extrabold">
          {horaConDia(venceEn, ahora, zonaHoraria)}
        </p>
      </>
    );
  }
  const minutos = Math.floor(restante / 60_000);
  const horas = Math.floor(minutos / 60);
  return (
    <>
      <p className="cifras text-4xl leading-none font-extrabold tracking-tight">
        {horas > 0 ? `${horas}:${String(minutos % 60).padStart(2, '0')}` : minutos}
      </p>
      <p className="mt-1 text-xs font-semibold text-tinta-suave">
        {horas > 0 ? 'horas restantes' : minutos === 1 ? 'minuto restante' : 'minutos restantes'}
      </p>
    </>
  );
}

export function HojaEnCurso({
  municipio,
  estacionamiento,
}: {
  municipio: MunicipioPublico;
  estacionamiento: Estacionamiento;
}) {
  const ahora = useAhora(10_000);
  const cliente = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const zh = municipio.zonaHoraria;
  const { ubicacion } = estacionamiento;

  const inicio = new Date(estacionamiento.inicio).getTime();
  const vence = new Date(estacionamiento.venceEn).getTime();
  const restante = vence - ahora.getTime();
  const vencido = restante <= 0;
  const porVencer = !vencido && restante < AVISO_MS;
  const proporcion = vence > inicio ? restante / (vence - inicio) : 0;

  const finalizar = useMutation({
    mutationFn: () =>
      api<Estacionamiento>(
        `municipios/${municipio.slug}/estacionamientos/${estacionamiento.id}/finalizar`,
        { metodo: 'POST' },
      ),
    onSuccess: async (finalizado) => {
      toast.success('Estacionamiento finalizado', {
        description: `Se cobraron ${finalizado.importeFormateado}.`,
      });
      await Promise.all([
        cliente.invalidateQueries({ queryKey: claves.activo(municipio.slug) }),
        cliente.invalidateQueries({ queryKey: claves.billetera(municipio.slug) }),
        cliente.invalidateQueries({ queryKey: claves.historial(municipio.slug) }),
      ]);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
    onSettled: () => {
      setConfirmando(false);
    },
  });

  return (
    <div className="space-y-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">
            Estacionado en
          </p>
          <h1 className="cifras mt-0.5 text-2xl leading-tight font-extrabold tracking-tight">
            {ubicacion
              ? `${ubicacion.calle} ${String(ubicacion.altura)}`
              : estacionamiento.zona.nombre}
          </h1>
          {ubicacion && (
            <p className="mt-1 text-sm font-semibold text-tinta-suave">
              {estacionamiento.zona.nombre} · mano {ubicacion.lado}
              {ubicacion.lugar !== null && ` · lugar ${String(ubicacion.lugar)}`}
            </p>
          )}
        </div>
        {vencido ? (
          <Etiqueta tono="peligro">Saldo agotado</Etiqueta>
        ) : porVencer ? (
          <Etiqueta tono="alerta" punto>
            Por vencer
          </Etiqueta>
        ) : (
          <Etiqueta tono="exito" punto>
            En curso
          </Etiqueta>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <AnilloDeTiempo
          proporcion={proporcion}
          tono={vencido ? 'peligro' : porVencer ? 'alerta' : 'marca'}
        >
          <TiempoRestante
            restante={restante}
            venceEn={estacionamiento.venceEn}
            ahora={ahora}
            zonaHoraria={zh}
          />
        </AnilloDeTiempo>
        <Placa patente={estacionamiento.patente} tamano="grande" />
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <Dato etiqueta="Desde">{hora(estacionamiento.inicio, zh)}</Dato>
        <Dato etiqueta="Transcurrido">{duracion(ahora.getTime() - inicio)}</Dato>
        <Dato etiqueta="Acumulado">{estacionamiento.importeFormateado.replace(',00', '')}</Dato>
      </dl>

      {(porVencer || vencido) && (
        <div className="flex items-center gap-3 rounded-control bg-alerta-suave p-3.5">
          <TriangleAlert className="size-5 shrink-0 text-alerta" aria-hidden />
          <p className="flex-1 text-sm leading-snug font-medium">
            {vencido
              ? 'El saldo se agotó. Cargá saldo y volvé a estacionar para evitar una multa.'
              : 'Te queda poco tiempo. Cargá saldo para extenderlo sin cortar el estacionamiento.'}
          </p>
          <Link
            href={`/${municipio.slug}/saldo` as Route}
            className="shrink-0 rounded-full bg-superficie px-3 py-1.5 text-sm font-bold text-tinta shadow-suave"
          >
            Cargar
          </Link>
        </div>
      )}

      {confirmando ? (
        <div className="animate-aparecer space-y-3 rounded-control border border-borde p-4">
          <p className="text-center text-sm font-semibold">
            ¿Finalizar ahora? Se cobra el tiempo usado: {estacionamiento.importeFormateado}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Boton
              variante="secundario"
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Seguir estacionado
            </Boton>
            <Boton
              variante="peligro"
              cargando={finalizar.isPending}
              onClick={() => {
                finalizar.mutate();
              }}
            >
              Finalizar
            </Boton>
          </div>
        </div>
      ) : (
        <Boton
          tamano="grande"
          variante={vencido ? 'primario' : 'contorno'}
          className="w-full"
          onClick={() => {
            setConfirmando(true);
          }}
        >
          Finalizar estacionamiento
        </Boton>
      )}
    </div>
  );
}
