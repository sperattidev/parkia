'use client';

import type { Estacionamiento, MunicipioPublico } from '@parkia/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, CircleCheck, Clock, Coins } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Placa } from '@/componentes/placa';
import { Boton, Etiqueta, Tarjeta } from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';
import { duracion, hora, horaConDia } from '@/lib/formato';
import { claves, useAhora } from '@/lib/hooks';

/** Con menos de este margen se sugiere cargar saldo. */
const AVISO_MS = 10 * 60_000;

function Fila({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-tinta-suave">{icono}</span>
      <span>{children}</span>
    </li>
  );
}

export function TarjetaEnCurso({
  municipio,
  estacionamiento,
}: {
  municipio: MunicipioPublico;
  estacionamiento: Estacionamiento;
}) {
  const ahora = useAhora();
  const cliente = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const zh = municipio.zonaHoraria;

  const restante = new Date(estacionamiento.venceEn).getTime() - ahora.getTime();
  const vencido = restante <= 0;
  const transcurrido = ahora.getTime() - new Date(estacionamiento.inicio).getTime();

  const finalizar = useMutation({
    mutationFn: () =>
      api<Estacionamiento>(
        `municipios/${municipio.slug}/estacionamientos/${estacionamiento.id}/finalizar`,
        { metodo: 'POST' },
      ),
    onSuccess: async (finalizado) => {
      toast.success(`Listo. Se cobraron ${finalizado.importeFormateado}.`);
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
    <Tarjeta className="space-y-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-tinta-suave">Estacionado en</p>
          <h1 className="text-xl font-bold">{estacionamiento.zona.nombre}</h1>
        </div>
        {vencido ? (
          <Etiqueta tono="peligro">Saldo agotado</Etiqueta>
        ) : (
          <Etiqueta tono="exito">
            <CircleCheck className="size-3.5" aria-hidden /> En curso
          </Etiqueta>
        )}
      </div>

      <Placa patente={estacionamiento.patente} />

      <ul className="space-y-2.5">
        <Fila icono={<Clock className="size-5" aria-hidden />}>
          Desde las {hora(estacionamiento.inicio, zh)} · {duracion(transcurrido)}
        </Fila>
        <Fila icono={<AlarmClock className="size-5" aria-hidden />}>
          {vencido ? (
            <span className="font-semibold text-peligro">
              Cubierto hasta: {horaConDia(estacionamiento.venceEn, ahora, zh)}
            </span>
          ) : (
            <>
              Cubierto hasta: <strong>{horaConDia(estacionamiento.venceEn, ahora, zh)}</strong>{' '}
              <span className="text-tinta-suave">(quedan {duracion(restante)})</span>
            </>
          )}
        </Fila>
        <Fila icono={<Coins className="size-5" aria-hidden />}>
          Acumulado: <strong>{estacionamiento.importeFormateado}</strong>
        </Fila>
      </ul>

      {!vencido && restante < AVISO_MS && (
        <p className="rounded-xl bg-alerta-suave p-3 text-sm">
          Te queda poco tiempo.{' '}
          <Link href={`/${municipio.slug}/saldo` as Route} className="font-semibold underline">
            Cargá saldo
          </Link>{' '}
          para extenderlo.
        </p>
      )}

      {confirmando ? (
        <div className="grid grid-cols-2 gap-2">
          <Boton
            variante="secundario"
            onClick={() => {
              setConfirmando(false);
            }}
          >
            Seguir
          </Boton>
          <Boton
            variante="peligro"
            cargando={finalizar.isPending}
            onClick={() => {
              finalizar.mutate();
            }}
          >
            Sí, finalizar
          </Boton>
        </div>
      ) : (
        <Boton
          className="w-full"
          onClick={() => {
            setConfirmando(true);
          }}
        >
          Finalizar estacionamiento
        </Boton>
      )}
    </Tarjeta>
  );
}
