'use client';

import type {
  CuadraDelMapa,
  Estacionamiento,
  MunicipioPublico,
  ZonaResumen,
} from '@parkia/contracts';
import type { Lado } from '@parkia/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CarFront,
  Check,
  LocateFixed,
  MousePointerClick,
  Plus,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
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
import { claves, useBilletera, useLugaresDeMano, useVehiculos } from '@/lib/hooks';

import { EstadoDeCobro, TarifaDeZona } from './resumen-de-zona';

/** Dónde va a estacionar el conductor: cuadra, mano y, si se detectó, altura. */
export interface Eleccion {
  readonly cuadra: CuadraDelMapa;
  readonly zona: ZonaResumen;
  readonly lado: Lado;
  readonly altura: number | undefined;
  /** La cuadra salió del GPS (y no de tocar el mapa). */
  readonly detectada: boolean;
}

const LADOS: readonly Lado[] = ['par', 'impar'];

function SelectorDeMano({
  cuadra,
  lado,
  alElegir,
}: {
  cuadra: CuadraDelMapa;
  lado: Lado;
  alElegir: (lado: Lado) => void;
}) {
  const { lugares, ocupados } = cuadra.properties;
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-bold">Mano</legend>
      <div className="grid grid-cols-2 gap-2">
        {LADOS.map((opcion) => {
          const capacidad = lugares[opcion];
          const libres = Math.max(capacidad - ocupados[opcion], 0);
          const elegida = opcion === lado;
          return (
            <label
              key={opcion}
              className={cn(
                'flex flex-col rounded-control border-2 px-3.5 py-2.5 transition',
                capacidad === 0 ? 'cursor-not-allowed border-borde opacity-55' : 'cursor-pointer',
                elegida && capacidad > 0
                  ? 'border-marca bg-marca-suave'
                  : 'border-borde hover:border-borde-fuerte',
              )}
            >
              <input
                type="radio"
                name="lado"
                value={opcion}
                checked={elegida}
                disabled={capacidad === 0}
                onChange={() => {
                  alElegir(opcion);
                }}
                className="sr-only"
              />
              <span className="text-[0.95rem] font-bold">
                Mano {opcion === 'par' ? 'par' : 'impar'}
              </span>
              <span className="cifras text-xs font-semibold text-tinta-suave">
                {capacidad === 0
                  ? 'No se estaciona'
                  : `${String(libres)} de ${String(capacidad)} libres`}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SelectorDeLugar({
  municipio,
  cuadraId,
  lado,
  lugar,
  alElegir,
}: {
  municipio: string;
  cuadraId: string;
  lado: Lado;
  lugar: number | undefined;
  alElegir: (lugar: number) => void;
}) {
  const lugares = useLugaresDeMano(municipio, cuadraId, lado);
  if (!lugares.data) {
    return <Esqueleto className="h-28 w-full rounded-control" />;
  }
  const ocupados = new Set(lugares.data.ocupados);
  const numeros = Array.from({ length: lugares.data.capacidad }, (_, i) => i + 1);
  return (
    <fieldset>
      <legend className="mb-2.5 flex w-full items-baseline justify-between text-sm font-bold">
        Lugar
        <span className="text-xs font-semibold text-tinta-tenue">
          Mirá el número pintado en el cordón
        </span>
      </legend>
      <div className="grid grid-cols-6 gap-1.5">
        {numeros.map((numero) => {
          const ocupado = ocupados.has(numero);
          const elegido = numero === lugar;
          return (
            <button
              key={numero}
              type="button"
              disabled={ocupado}
              aria-pressed={elegido}
              aria-label={`Lugar ${String(numero)}${ocupado ? ', ocupado' : ''}`}
              onClick={() => {
                alElegir(numero);
              }}
              className={cn(
                'cifras h-10 rounded-xl text-sm font-bold transition',
                elegido
                  ? 'bg-marca text-sobre-marca shadow-marca'
                  : ocupado
                    ? 'cursor-not-allowed bg-superficie-2 text-tinta-tenue line-through'
                    : 'border border-borde bg-superficie hover:border-marca hover:text-marca',
              )}
            >
              {numero}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Encabezado({ eleccion, buscando }: { eleccion: Eleccion | undefined; buscando: boolean }) {
  if (!eleccion) {
    return (
      <div>
        <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">
          {buscando ? 'Buscando tu ubicación…' : 'Estacioná en'}
        </p>
        <h1 className="mt-0.5 text-2xl leading-tight font-extrabold tracking-tight">
          Elegí la cuadra
        </h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-tinta-suave">
          <MousePointerClick className="size-4 shrink-0" aria-hidden />
          Tocá en el mapa la calle donde estacionaste.
        </p>
      </div>
    );
  }
  const { cuadra, zona, altura, detectada } = eleccion;
  const { calle, alturaDesde, alturaHasta } = cuadra.properties;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-tinta-tenue uppercase">
          {detectada && <LocateFixed className="size-3.5 text-marca" aria-hidden />}
          {detectada ? 'Estás en' : 'Estacionás en'}
        </p>
        <h1 className="cifras mt-0.5 text-2xl leading-tight font-extrabold tracking-tight text-balance">
          {calle} {altura ?? `${String(alturaDesde)}–${String(alturaHasta)}`}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-tinta-suave">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: zona.color }}
            aria-hidden
          />
          {zona.nombre}
        </p>
      </div>
      <EstadoDeCobro zona={zona} />
    </div>
  );
}

export function HojaNueva({
  municipio,
  eleccion,
  alElegirLado,
  alUsarUbicacion,
  buscando,
  fueraDeZona,
}: {
  municipio: MunicipioPublico;
  eleccion: Eleccion | undefined;
  alElegirLado: (lado: Lado) => void;
  /** Presente cuando la cuadra tocada no es la del GPS. */
  alUsarUbicacion?: () => void;
  buscando: boolean;
  fueraDeZona: boolean;
}) {
  const router = useRouter();
  const cliente = useQueryClient();
  const vehiculos = useVehiculos();
  const billetera = useBilletera(municipio.slug);
  const [patenteElegida, setPatenteElegida] = useState<string>();
  // El lugar elegido vale solo para la cuadra y mano en que se eligió.
  const [lugarElegido, setLugarElegido] = useState<{ clave: string; numero: number }>();

  const patente = patenteElegida ?? vehiculos.data?.[0]?.patente;
  const rutaSaldo = `/${municipio.slug}/saldo` as Route;
  const claveDeMano = eleccion ? `${eleccion.cuadra.id}:${eleccion.lado}` : '';
  const lugar = lugarElegido?.clave === claveDeMano ? lugarElegido.numero : undefined;
  const numerada = eleccion?.cuadra.properties.lugaresNumerados ?? false;
  const manoSinLugares = eleccion ? eleccion.cuadra.properties.lugares[eleccion.lado] === 0 : false;

  const iniciar = useMutation({
    mutationFn: () => {
      if (!eleccion || !patente) throw new Error('Falta elegir cuadra o vehículo.');
      return api<Estacionamiento>(`municipios/${municipio.slug}/estacionamientos`, {
        metodo: 'POST',
        cuerpo: {
          cuadraId: eleccion.cuadra.id,
          lado: eleccion.lado,
          ...(eleccion.altura !== undefined && { altura: eleccion.altura }),
          ...(lugar !== undefined && { lugar }),
          patente,
        },
      });
    },
    onSuccess: async (estacionamiento) => {
      toast.success('Estacionamiento iniciado', {
        description: `${estacionamiento.ubicacion?.direccion ?? estacionamiento.zona.nombre}. Cubierto hasta ${horaConDia(estacionamiento.venceEn, new Date(), municipio.zonaHoraria)}.`,
      });
      cliente.setQueryData(claves.activo(municipio.slug), estacionamiento);
      // Actualiza la ocupación que muestra el mapa.
      router.refresh();
      await cliente.invalidateQueries({ queryKey: claves.historial(municipio.slug) });
    },
    onError: async (error) => {
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
      if (error instanceof ErrorDeParkia && error.codigo === 'LUGAR_OCUPADO' && eleccion) {
        setLugarElegido(undefined);
        await cliente.invalidateQueries({
          queryKey: claves.lugares(municipio.slug, eleccion.cuadra.id, eleccion.lado),
        });
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
      <Encabezado eleccion={eleccion} buscando={buscando} />

      {alUsarUbicacion && (
        <button
          type="button"
          onClick={alUsarUbicacion}
          className="flex items-center gap-1.5 text-sm font-bold text-marca"
        >
          <LocateFixed className="size-4" aria-hidden /> Usar mi ubicación
        </button>
      )}

      {fueraDeZona && !eleccion && (
        <p className="flex gap-2.5 rounded-control bg-alerta-suave p-3.5 text-sm leading-snug font-medium">
          <TriangleAlert className="size-5 shrink-0 text-alerta" aria-hidden />
          Tu ubicación no está sobre una cuadra paga. Si estacionaste en una, tocala en el mapa.
        </p>
      )}

      {eleccion && (
        <>
          <TarifaDeZona zona={eleccion.zona} />
          <SelectorDeMano cuadra={eleccion.cuadra} lado={eleccion.lado} alElegir={alElegirLado} />
          {numerada && !manoSinLugares && (
            <SelectorDeLugar
              municipio={municipio.slug}
              cuadraId={eleccion.cuadra.id}
              lado={eleccion.lado}
              lugar={lugar}
              alElegir={(numero) => {
                setLugarElegido({ clave: claveDeMano, numero });
              }}
            />
          )}
        </>
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
        disabled={!eleccion || !patente || manoSinLugares || (numerada && lugar === undefined)}
        cargando={iniciar.isPending}
        onClick={() => {
          iniciar.mutate();
        }}
      >
        {numerada && eleccion && lugar === undefined
          ? 'Elegí tu lugar'
          : `Estacionar ${patente ? patenteLegible(patente) : ''}`}
      </Boton>
    </div>
  );
}
