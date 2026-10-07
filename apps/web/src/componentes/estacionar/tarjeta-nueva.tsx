'use client';

import type { Estacionamiento, MunicipioPublico, ZonasGeoJson } from '@parkia/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, TriangleAlert } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Boton, Cargando, Etiqueta, Tarjeta } from '@/componentes/ui';
import { api, ErrorDeParkia, mensajeDeError } from '@/lib/cliente';
import { cn } from '@/lib/cn';
import { horaConDia } from '@/lib/formato';
import { claves, useBilletera, useVehiculos } from '@/lib/hooks';

export function TarjetaNueva({
  municipio,
  zonas,
  zonaId,
  alElegirZona,
  detectada,
  fueraDeZona,
}: {
  municipio: MunicipioPublico;
  zonas: ZonasGeoJson;
  zonaId: string | undefined;
  alElegirZona: (id: string) => void;
  detectada: boolean;
  fueraDeZona: boolean;
}) {
  const router = useRouter();
  const cliente = useQueryClient();
  const vehiculos = useVehiculos();
  const billetera = useBilletera(municipio.slug);
  const [patenteElegida, setPatenteElegida] = useState<string>();

  const zona = zonas.features.find((z) => z.id === zonaId);
  const patente = patenteElegida ?? vehiculos.data?.[0]?.patente;
  const rutaSaldo = `/${municipio.slug}/saldo` as Route;

  const iniciar = useMutation({
    mutationFn: () =>
      api<Estacionamiento>(`municipios/${municipio.slug}/estacionamientos`, {
        metodo: 'POST',
        cuerpo: { zonaId, patente },
      }),
    onSuccess: async (estacionamiento) => {
      toast.success(
        `Estacionamiento iniciado. Cubierto hasta: ${horaConDia(estacionamiento.venceEn, new Date(), municipio.zonaHoraria)}.`,
      );
      cliente.setQueryData(claves.activo(municipio.slug), estacionamiento);
      await cliente.invalidateQueries({ queryKey: claves.historial(municipio.slug) });
    },
    onError: (error) => {
      if (error instanceof ErrorDeParkia && error.codigo === 'SALDO_INSUFICIENTE') {
        toast.error(error.message, {
          action: {
            label: 'Cargar saldo',
            onClick: () => {
              router.push(rutaSaldo);
            },
          },
        });
        return;
      }
      toast.error(mensajeDeError(error));
    },
  });

  if (vehiculos.isPending || billetera.isPending) {
    return (
      <Tarjeta>
        <Cargando />
      </Tarjeta>
    );
  }

  const sinVehiculos = vehiculos.data?.length === 0;

  return (
    <Tarjeta className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-sm text-tinta-suave">
            <MapPin className="size-4" aria-hidden />
            {detectada ? 'Estás en' : 'Zona'}
          </p>
          {zonas.features.length > 1 && !detectada ? (
            <select
              aria-label="Zona"
              value={zonaId ?? ''}
              onChange={(evento) => {
                alElegirZona(evento.target.value);
              }}
              className="mt-0.5 rounded-lg border border-borde bg-superficie px-2 py-1 text-lg font-bold"
            >
              <option value="" disabled>
                Elegí la zona
              </option>
              {zonas.features.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.properties.nombre}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="text-xl font-bold">{zona?.properties.nombre ?? 'Elegí la zona'}</h1>
          )}
        </div>
        {zona &&
          (zona.properties.enHorarioDeCobro ? (
            <Etiqueta tono="marca">Se cobra ahora</Etiqueta>
          ) : (
            <Etiqueta>Ahora no se cobra</Etiqueta>
          ))}
      </div>

      {fueraDeZona && (
        <p className="flex gap-2 rounded-xl bg-alerta-suave p-3 text-sm">
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          Tu ubicación no parece estar dentro de una zona paga. Si estacionaste en una, elegila
          igual.
        </p>
      )}

      {sinVehiculos ? (
        <Link
          href={`/${municipio.slug}/vehiculos` as Route}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borde font-semibold text-marca hover:bg-marca-suave"
        >
          <Plus className="size-5" aria-hidden /> Agregá tu patente para estacionar
        </Link>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-tinta-suave">Vehículo</legend>
          <div className="flex flex-wrap gap-2">
            {vehiculos.data?.map((vehiculo) => (
              <label
                key={vehiculo.id}
                className={cn(
                  'cursor-pointer rounded-xl border-2 px-3 py-2 font-mono font-bold tracking-wider',
                  'has-checked:border-marca has-checked:bg-marca-suave has-checked:text-marca',
                  'border-borde',
                )}
              >
                <input
                  type="radio"
                  name="patente"
                  value={vehiculo.patente}
                  checked={patente === vehiculo.patente}
                  onChange={() => {
                    setPatenteElegida(vehiculo.patente);
                  }}
                  className="sr-only"
                />
                {vehiculo.patente}
                {vehiculo.alias && (
                  <span className="ml-1.5 font-sans text-xs font-medium text-tinta-suave">
                    {vehiculo.alias}
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center justify-between rounded-xl bg-superficie-2 px-4 py-3">
        <span className="text-tinta-suave">
          Saldo: <strong className="text-tinta">{billetera.data?.saldoFormateado}</strong>
        </span>
        <Link href={rutaSaldo} className="text-sm font-semibold text-marca">
          Cargar
        </Link>
      </div>

      <Boton
        className="w-full"
        disabled={!zonaId || !patente}
        cargando={iniciar.isPending}
        onClick={() => {
          iniciar.mutate();
        }}
      >
        Estacionar acá
      </Boton>
    </Tarjeta>
  );
}
