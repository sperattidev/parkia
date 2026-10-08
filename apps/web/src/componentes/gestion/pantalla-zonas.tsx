'use client';

import type { CuadrasDeGestion, ZonaDeGestion } from '@parkia/contracts';
import { Brush, Clock, MousePointerClick, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Mapa } from '@/componentes/mapa';
import { Boton, Esqueleto, Etiqueta } from '@/componentes/ui';
import { mensajeDeError } from '@/lib/cliente';
import { cn } from '@/lib/cn';
import { pesosRedondos } from '@/lib/formato';
import { useCambiarCuadra, useCuadras, useGuardarZona, useZonas } from '@/lib/gestion';

import { useGestion } from './contexto';
import { EditorDeTarifa } from './editor-de-tarifa';
import { ContenidoDeGestion, EncabezadoDeSeccion } from './piezas';

type Pestana = 'tarifas' | 'cuadras';

function TarjetaDeZona({ zona }: { zona: ZonaDeGestion }) {
  const { municipio } = useGestion();
  const [editando, setEditando] = useState(false);
  const guardar = useGuardarZona(municipio.slug);

  return (
    <article className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: zona.color }}
              aria-hidden
            />
            {zona.nombre}
            {!zona.activa && <Etiqueta>Inactiva</Etiqueta>}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-tinta-suave">
            <Clock className="size-4" aria-hidden />
            <span className="cifras font-bold text-tinta">
              {pesosRedondos(zona.resumen.tarifa.precioHora)}/h
            </span>
            · {zona.resumen.tarifa.horario}
          </p>
          <p className="cifras mt-0.5 text-xs text-tinta-tenue">
            {zona.cuadras} cuadras · {zona.capacidad} lugares
          </p>
        </div>
        {!editando && (
          <div className="flex gap-2">
            <Boton
              variante="secundario"
              tamano="chico"
              cargando={guardar.isPending}
              onClick={() => {
                guardar.mutate(
                  { id: zona.id, activa: !zona.activa },
                  { onError: (error) => toast.error(mensajeDeError(error)) },
                );
              }}
            >
              {zona.activa ? 'Desactivar' : 'Activar'}
            </Boton>
            <Boton
              tamano="chico"
              onClick={() => {
                setEditando(true);
              }}
            >
              <Pencil className="size-4" aria-hidden /> Editar tarifa
            </Boton>
          </div>
        )}
      </div>
      {editando && (
        <div className="mt-5 border-t border-borde pt-5">
          <EditorDeTarifa
            zona={zona}
            alTerminar={() => {
              setEditando(false);
            }}
          />
        </div>
      )}
    </article>
  );
}

const SIN_ZONA = 'sin-zona';

function EditorDeCuadras({
  zonas,
  cuadras,
}: {
  zonas: ZonaDeGestion[];
  cuadras: CuadrasDeGestion;
}) {
  const { municipio } = useGestion();
  const [pincel, setPincel] = useState<string>();
  const [elegida, setElegida] = useState<string>();
  const cambiarCuadra = useCambiarCuadra(municipio.slug);

  const mapa = useMemo(
    () => ({ zonas: zonas.map(({ id, nombre, color }) => ({ id, nombre, color })), cuadras }),
    [zonas, cuadras],
  );
  const inactivas = useMemo(
    () => new Set(cuadras.features.filter((c) => !c.properties.activa).map((c) => c.id)),
    [cuadras],
  );
  const cuadra = cuadras.features.find((c) => c.id === elegida);

  const aplicar = (id: string, cambio: Record<string, unknown>) => {
    cambiarCuadra.mutate(
      { id, ...cambio },
      { onError: (error) => toast.error(mensajeDeError(error)) },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <section className="relative h-[65vh] min-h-96 overflow-hidden rounded-tarjeta bg-superficie shadow-tarjeta">
        <div className="absolute inset-0">
          <Mapa
            mapa={mapa}
            cuadraSeleccionada={elegida}
            atenuadas={inactivas}
            conHoja={false}
            geolocalizarAlAbrir={false}
            alTocarCuadra={(id) => {
              if (pincel === undefined) {
                setElegida(id);
                return;
              }
              aplicar(id, { zonaId: pincel === SIN_ZONA ? null : pincel });
            }}
            className="size-full"
          />
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
          <h2 className="flex items-center gap-2 font-extrabold">
            <Brush className="size-4" aria-hidden /> Pintar cuadras
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Elegí una zona y tocá las cuadras que la forman: las 4 de una manzana, o 3 si es
            triangular.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ...zonas.map((z) => ({ id: z.id, nombre: z.nombre, color: z.color })),
              { id: SIN_ZONA, nombre: 'Sin zona', color: '#8A97AB' },
            ].map((opcion) => {
              const activa = pincel === opcion.id;
              return (
                <button
                  key={opcion.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => {
                    setPincel(activa ? undefined : opcion.id);
                  }}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold transition',
                    activa ? 'border-tinta bg-superficie-2' : 'border-borde',
                  )}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: opcion.color }}
                    aria-hidden
                  />
                  {opcion.nombre}
                </button>
              );
            })}
          </div>
          {pincel !== undefined && (
            <p className="mt-3 rounded-xl bg-marca-suave px-3 py-2 text-xs font-semibold text-marca">
              Pintando: cada cuadra que toques pasa a{' '}
              {pincel === SIN_ZONA ? 'no tener zona' : zonas.find((z) => z.id === pincel)?.nombre}.
            </p>
          )}
        </section>

        <section className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
          {!cuadra ? (
            <p className="flex items-center gap-2 text-sm text-tinta-suave">
              <MousePointerClick className="size-4 shrink-0" aria-hidden />
              Sin pincel, tocá una cuadra para ver y cambiar su capacidad.
            </p>
          ) : (
            <FichaDeCuadra
              key={cuadra.id}
              cuadra={cuadra}
              zonas={zonas}
              guardando={cambiarCuadra.isPending}
              alGuardar={(cambio) => {
                aplicar(cuadra.id, cambio);
              }}
            />
          )}
        </section>
      </aside>
    </div>
  );
}

function FichaDeCuadra({
  cuadra,
  zonas,
  guardando,
  alGuardar,
}: {
  cuadra: CuadrasDeGestion['features'][number];
  zonas: ZonaDeGestion[];
  guardando: boolean;
  alGuardar: (cambio: Record<string, unknown>) => void;
}) {
  const p = cuadra.properties;
  const [par, setPar] = useState(String(p.lugares.par));
  const [impar, setImpar] = useState(String(p.lugares.impar));
  const zona = zonas.find((z) => z.id === p.zonaId);
  const campo =
    'mt-1 h-10 w-full rounded-xl border border-borde bg-superficie px-3 text-sm focus:border-marca focus:outline-none';

  return (
    <form
      className="space-y-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        alGuardar({ lugaresPar: Number(par), lugaresImpar: Number(impar) });
      }}
    >
      <div>
        <h3 className="cifras text-lg font-extrabold">
          {p.calle} {p.alturaDesde}–{p.alturaHasta}
        </h3>
        <p className="text-sm text-tinta-suave">{zona ? zona.nombre : 'Sin zona: no se cobra'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-tinta-suave">
          Lugares mano par
          <input
            type="number"
            min={0}
            max={200}
            value={par}
            onChange={(evento) => {
              setPar(evento.target.value);
            }}
            className={campo}
          />
        </label>
        <label className="text-xs font-semibold text-tinta-suave">
          Lugares mano impar
          <input
            type="number"
            min={0}
            max={200}
            value={impar}
            onChange={(evento) => {
              setImpar(evento.target.value);
            }}
            className={campo}
          />
        </label>
      </div>
      <p className="text-xs text-tinta-tenue">0 lugares: sobre esa mano no se estaciona.</p>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={p.lugaresNumerados}
          onChange={(evento) => {
            alGuardar({ lugaresNumerados: evento.target.checked });
          }}
          className="size-4 accent-[var(--color-marca)]"
        />
        Lugares numerados en el cordón
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={p.activa}
          onChange={(evento) => {
            alGuardar({ activa: evento.target.checked });
          }}
          className="size-4 accent-[var(--color-marca)]"
        />
        Cuadra habilitada
      </label>
      <Boton type="submit" className="w-full" cargando={guardando}>
        Guardar capacidad
      </Boton>
    </form>
  );
}

export function PantallaZonas() {
  const { municipio } = useGestion();
  const [pestana, setPestana] = useState<Pestana>('tarifas');
  const [creando, setCreando] = useState(false);
  const zonas = useZonas(municipio.slug);
  const cuadras = useCuadras(municipio.slug);

  return (
    <ContenidoDeGestion>
      <EncabezadoDeSeccion
        titulo="Zonas y tarifas"
        descripcion="Los cambios de tarifa rigen para los estacionamientos que empiezan después: los que están en curso conservan la tarifa con la que empezaron. Todo cambio queda en la auditoría."
        accion={
          <Boton
            onClick={() => {
              setPestana('tarifas');
              setCreando(true);
            }}
          >
            <Plus className="size-4" aria-hidden /> Nueva zona
          </Boton>
        }
      />

      <div className="flex rounded-xl bg-superficie-2 p-1 sm:w-fit" role="tablist">
        {(['tarifas', 'cuadras'] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            role="tab"
            aria-selected={pestana === opcion}
            onClick={() => {
              setPestana(opcion);
            }}
            className={cn(
              'h-9 flex-1 rounded-lg px-4 text-sm font-semibold transition sm:flex-none',
              pestana === opcion ? 'bg-superficie shadow-suave' : 'text-tinta-suave',
            )}
          >
            {opcion === 'tarifas' ? 'Tarifas' : 'Cuadras'}
          </button>
        ))}
      </div>

      {!zonas.data || !cuadras.data ? (
        <Esqueleto className="h-96 rounded-tarjeta" />
      ) : pestana === 'tarifas' ? (
        <div className="space-y-4">
          {creando && (
            <article className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
              <h2 className="mb-5 text-lg font-extrabold">Nueva zona</h2>
              <EditorDeTarifa
                alTerminar={() => {
                  setCreando(false);
                }}
              />
            </article>
          )}
          {zonas.data.map((zona) => (
            <TarjetaDeZona key={zona.id} zona={zona} />
          ))}
        </div>
      ) : (
        <EditorDeCuadras zonas={zonas.data} cuadras={cuadras.data} />
      )}
    </ContenidoDeGestion>
  );
}
