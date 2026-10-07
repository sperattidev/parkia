'use client';

import type { Estacionamiento, MunicipioPublico, ZonasGeoJson } from '@parkia/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CarFront, Check, LocateFixed, Plus, TriangleAlert, Wallet } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { patenteLegible } from '@/componentes/placa';
import { Boton, Esqueleto } from '@/componentes/ui';
import { api, ErrorDeParkia, mensajeDeError } from '@/lib/cliente';
import { cn } from '@/lib/cn';
import { horaConDia } from '@/lib/formato';
import { claves, useBilletera, useVehiculos } from '@/lib/hooks';

import { EstadoDeCobro, TarifaDeZona } from './resumen-de-zona';

export function HojaNueva({
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
      toast.success('Estacionamiento iniciado', {
        description: `Cubierto hasta ${horaConDia(estacionamiento.venceEn, new Date(), municipio.zonaHoraria)}.`,
      });
      cliente.setQueryData(claves.activo(municipio.slug), estacionamiento);
      await cliente.invalidateQueries({ queryKey: claves.historial(municipio.slug) });
    },
    onError: (error) => {
      if (error instanceof ErrorDeParkia && error.codigo === 'SALDO_INSUFICIENTE') {
        toast.error('Saldo insuficiente', {
          description: error.message,
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
      <div className="space-y-4" aria-busy>
        <Esqueleto className="h-4 w-24" />
        <Esqueleto className="h-7 w-44" />
        <Esqueleto className="h-12 w-full" />
        <div className="flex gap-2">
          <Esqueleto className="h-16 w-36" />
          <Esqueleto className="h-16 w-36" />
        </div>
        <Esqueleto className="h-14 w-full rounded-control" />
      </div>
    );
  }

  const sinVehiculos = vehiculos.data?.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-tinta-tenue uppercase">
            {detectada && <LocateFixed className="size-3.5 text-marca" aria-hidden />}
            {detectada ? 'Estás en' : 'Estacioná en'}
          </p>
          {zonas.features.length > 1 && !detectada ? (
            <select
              aria-label="Zona"
              value={zonaId ?? ''}
              onChange={(evento) => {
                alElegirZona(evento.target.value);
              }}
              className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-2 text-lg font-extrabold"
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
            <h1 className="mt-0.5 truncate text-2xl leading-tight font-extrabold tracking-tight">
              {zona?.properties.nombre ?? 'Elegí la zona'}
            </h1>
          )}
        </div>
        {zona && <EstadoDeCobro zona={zona} />}
      </div>

      {zona && <TarifaDeZona zona={zona} />}

      {fueraDeZona && (
        <p className="flex gap-2.5 rounded-control bg-alerta-suave p-3.5 text-sm leading-snug font-medium">
          <TriangleAlert className="size-5 shrink-0 text-alerta" aria-hidden />
          Tu ubicación no parece estar dentro de una zona paga. Si estacionaste en una, podés seguir
          igual.
        </p>
      )}

      <fieldset>
        <legend className="mb-2.5 text-sm font-bold">Vehículo</legend>
        {sinVehiculos ? (
          <Link
            href={`/${municipio.slug}/vehiculos` as Route}
            className="flex h-16 items-center justify-center gap-2 rounded-control border-2 border-dashed border-borde-fuerte font-bold text-marca transition hover:border-marca hover:bg-marca-suave"
          >
            <Plus className="size-5" aria-hidden /> Agregá tu patente
          </Link>
        ) : (
          <div className="sin-barra -mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 lg:-mx-6 lg:px-6">
            {vehiculos.data?.map((vehiculo) => {
              const elegido = patente === vehiculo.patente;
              return (
                <label
                  key={vehiculo.id}
                  className={cn(
                    'relative flex min-w-[9.5rem] shrink-0 cursor-pointer snap-start flex-col rounded-control border-2 px-3.5 py-2.5 transition',
                    elegido
                      ? 'border-marca bg-marca-suave'
                      : 'border-borde bg-superficie hover:border-borde-fuerte',
                  )}
                >
                  <input
                    type="radio"
                    name="patente"
                    value={vehiculo.patente}
                    checked={elegido}
                    onChange={() => {
                      setPatenteElegida(vehiculo.patente);
                    }}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-tinta-suave">
                    <CarFront className="size-3.5" aria-hidden />
                    {vehiculo.alias ?? 'Vehículo'}
                  </span>
                  <span className="mt-0.5 font-mono text-[1.05rem] font-bold tracking-wider">
                    {patenteLegible(vehiculo.patente)}
                  </span>
                  {elegido && (
                    <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-marca text-sobre-marca">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </label>
              );
            })}
            <Link
              href={`/${municipio.slug}/vehiculos` as Route}
              aria-label="Agregar vehículo"
              className="grid w-14 shrink-0 place-items-center rounded-control border-2 border-dashed border-borde text-tinta-suave transition hover:border-marca hover:text-marca"
            >
              <Plus className="size-5" aria-hidden />
            </Link>
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-3 rounded-control border border-borde px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-marca-suave text-marca">
          <Wallet className="size-[1.1rem]" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-tinta-tenue">Saldo disponible</p>
          <p className="cifras text-lg leading-tight font-extrabold">
            {billetera.data?.saldoFormateado}
          </p>
        </div>
        <Link
          href={rutaSaldo}
          className="rounded-full bg-superficie-2 px-3.5 py-1.5 text-sm font-bold transition hover:bg-borde"
        >
          Cargar
        </Link>
      </div>

      <Boton
        tamano="grande"
        className="w-full"
        disabled={!zonaId || !patente}
        cargando={iniciar.isPending}
        onClick={() => {
          iniciar.mutate();
        }}
      >
        Estacionar {patente ? patenteLegible(patente) : ''}
      </Boton>
    </div>
  );
}
