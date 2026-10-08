'use client';

import {
  reglaTarifariaZonaSchema,
  type ReglaTarifariaZonaEntrada,
  type ZonaDeGestion,
} from '@parkia/contracts';
import { inicioDeFecha, liquidarEstacionamiento, sumarDias } from '@parkia/domain';
import { Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Boton } from '@/componentes/ui';
import { mensajeDeError } from '@/lib/cliente';
import { cn } from '@/lib/cn';
import { pesos } from '@/lib/formato';
import { useGuardarZona } from '@/lib/gestion';

import { useGestion } from './contexto';

type Dia = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DIAS: readonly { dia: Dia; letra: string }[] = [
  { dia: 0, letra: 'D' },
  { dia: 1, letra: 'L' },
  { dia: 2, letra: 'M' },
  { dia: 3, letra: 'M' },
  { dia: 4, letra: 'J' },
  { dia: 5, letra: 'V' },
  { dia: 6, letra: 'S' },
];
const NOMBRES_DE_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DURACIONES = [30, 60, 120, 240] as const;

/** Nombre de cada campo de la regla tal como aparece en el formulario. */
const CAMPOS: Record<string, string> = {
  horario: 'Horario de cobro',
  tramos: 'Precio por hora',
  fraccionMinutos: 'Fracción',
  minimoMinutos: 'Mínimo',
  toleranciaMinutos: 'Tolerancia',
  topePorJornada: 'Tope por día',
  diasEspeciales: 'Feriados',
};

/** Clave estable de cada fila editable (franja, tramo o feriado) para React. */
let ultimaClave = 0;
const nuevaClave = () => String(++ultimaClave);

interface Franja {
  clave: string;
  dias: Dia[];
  desde: string;
  hasta: string;
}

interface Formulario {
  nombre: string;
  color: string;
  horario: Franja[];
  tramos: { clave: string; desdeMinuto: string; precio: string }[];
  fraccion: string;
  minimo: string;
  tolerancia: string;
  tope: string;
  feriados: {
    clave: string;
    fecha: string;
    motivo: string;
    franjas: { desde: string; hasta: string }[];
  }[];
}

const aPesos = (centavos: number) => (centavos / 100).toString().replace('.', ',');
const aCentavos = (pesosTexto: string) =>
  Math.round(Number(pesosTexto.replace(/\./g, '').replace(',', '.')) * 100);

const REGLA_INICIAL: ReglaTarifariaZonaEntrada = {
  horario: [{ dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '20:00' }],
  fraccionMinutos: 15,
  minimoMinutos: 30,
  toleranciaMinutos: 5,
  tramos: [{ desdeMinuto: 0, precioHora: 100_000 }],
};

function aFormulario(zona: ZonaDeGestion | undefined): Formulario {
  const regla = (zona?.regla ?? REGLA_INICIAL) as ReglaTarifariaZonaEntrada;
  return {
    nombre: zona?.nombre ?? '',
    color: zona?.color ?? '#7C3AED',
    horario: regla.horario.map((f) => ({
      clave: nuevaClave(),
      dias: [...f.dias],
      desde: f.desde,
      hasta: f.hasta,
    })),
    tramos: regla.tramos.map((t) => ({
      clave: nuevaClave(),
      desdeMinuto: String(t.desdeMinuto),
      precio: aPesos(t.precioHora),
    })),
    fraccion: String(regla.fraccionMinutos),
    minimo: String(regla.minimoMinutos),
    tolerancia: String(regla.toleranciaMinutos),
    tope: regla.topePorJornada === undefined ? '' : aPesos(regla.topePorJornada),
    feriados: (regla.diasEspeciales ?? []).map((d) => ({
      clave: nuevaClave(),
      fecha: d.fecha,
      motivo: d.motivo ?? '',
      franjas: d.franjas.map((f) => ({ desde: f.desde, hasta: f.hasta })),
    })),
  };
}

function aRegla(formulario: Formulario): ReglaTarifariaZonaEntrada {
  return {
    horario: formulario.horario.map((f) => ({
      dias: [...f.dias].sort(),
      desde: f.desde,
      hasta: f.hasta,
    })),
    tramos: formulario.tramos.map((t) => ({
      desdeMinuto: Number(t.desdeMinuto),
      precioHora: aCentavos(t.precio),
    })),
    fraccionMinutos: Number(formulario.fraccion),
    minimoMinutos: Number(formulario.minimo),
    toleranciaMinutos: Number(formulario.tolerancia),
    ...(formulario.tope.trim() && { topePorJornada: aCentavos(formulario.tope) }),
    ...(formulario.feriados.length > 0 && {
      diasEspeciales: formulario.feriados.map((d) => ({
        fecha: d.fecha,
        franjas: d.franjas,
        ...(d.motivo.trim() && { motivo: d.motivo.trim() }),
      })),
    }),
  };
}

/**
 * Cuánto pagaría un conductor que estaciona al empezar la primera franja de
 * cobro: el mismo motor que liquida los cobros reales, aplicado a la tarifa
 * que se está editando.
 */
function vistaPrevia(regla: ReglaTarifariaZonaEntrada, zonaHoraria: string) {
  const resultado = reglaTarifariaZonaSchema.safeParse(regla);
  if (!resultado.success) {
    const [problema] = resultado.error.issues;
    const campo = CAMPOS[String(problema?.path[0])];
    const mensaje = problema?.message ?? 'La tarifa tiene errores.';
    return { error: campo ? `${campo}: ${mensaje}` : mensaje };
  }
  const [franja] = resultado.data.horario;
  if (!franja) return { error: 'Falta el horario de cobro.' };
  const dia = Math.min(...franja.dias);
  // 4/10/2026 es domingo: sumándole el día de la semana se obtiene un día típico.
  const fecha = sumarDias('2026-10-04', dia);
  const [horas = 0, minutos = 0] = franja.desde.split(':').map(Number);
  const inicio = new Date(
    inicioDeFecha(fecha, zonaHoraria).getTime() + (horas * 60 + minutos) * 60_000,
  );
  const reglaCompleta = { ...resultado.data, zonaHoraria };
  return {
    dia: NOMBRES_DE_DIAS[dia] ?? '',
    desde: franja.desde,
    importes: DURACIONES.map((duracion) => ({
      duracion,
      importe: liquidarEstacionamiento(reglaCompleta, {
        inicio,
        fin: new Date(inicio.getTime() + duracion * 60_000),
      }).importe,
    })),
  };
}

const campo =
  'h-10 w-full rounded-xl border border-borde bg-superficie px-3 text-sm text-tinta focus:border-marca focus:ring-4 focus:ring-marca/15 focus:outline-none';

function Grupo({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-extrabold">{titulo}</legend>
      {ayuda && <p className="-mt-1 text-xs text-tinta-suave">{ayuda}</p>}
      {children}
    </fieldset>
  );
}

function CampoNumerico({
  etiqueta,
  valor,
  sufijo,
  alCambiar,
}: {
  etiqueta: string;
  valor: string;
  sufijo: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-tinta-suave">
      {etiqueta}
      <span className="relative mt-1 block">
        <input
          inputMode="decimal"
          value={valor}
          onChange={(evento) => {
            alCambiar(evento.target.value.replace(/[^\d,]/g, ''));
          }}
          className={cn(campo, 'pr-12')}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-tinta-tenue">
          {sufijo}
        </span>
      </span>
    </label>
  );
}

function BotonQuitar({ etiqueta, alQuitar }: { etiqueta: string; alQuitar: () => void }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={alQuitar}
      className="grid size-10 shrink-0 place-items-center rounded-xl text-tinta-tenue transition hover:bg-peligro-suave hover:text-peligro"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

export function EditorDeTarifa({
  zona,
  alTerminar,
}: {
  zona?: ZonaDeGestion | undefined;
  alTerminar: () => void;
}) {
  const { municipio } = useGestion();
  const [formulario, setFormulario] = useState(() => aFormulario(zona));
  const guardar = useGuardarZona(municipio.slug);
  const regla = aRegla(formulario);
  const previa = vistaPrevia(regla, municipio.zonaHoraria);

  const cambiar = (cambio: Partial<Formulario>) => {
    setFormulario((actual) => ({ ...actual, ...cambio }));
  };
  const cambiarFranja = (indice: number, cambio: Partial<Franja>) => {
    cambiar({
      horario: formulario.horario.map((f, i) => (i === indice ? { ...f, ...cambio } : f)),
    });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar.mutate(
          {
            ...(zona && { id: zona.id }),
            nombre: formulario.nombre.trim(),
            color: formulario.color,
            regla,
          },
          {
            onSuccess: () => {
              toast.success(zona ? 'Tarifa actualizada' : 'Zona creada', {
                description: zona
                  ? 'Rige para los estacionamientos que empiecen desde ahora.'
                  : 'Asignale cuadras en la pestaña Cuadras.',
              });
              alTerminar();
            },
            onError: (error) => toast.error(mensajeDeError(error)),
          },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs font-semibold text-tinta-suave">
          Nombre de la zona
          <input
            required
            minLength={2}
            maxLength={60}
            value={formulario.nombre}
            onChange={(evento) => {
              cambiar({ nombre: evento.target.value });
            }}
            className={cn(campo, 'mt-1')}
          />
        </label>
        <label className="block text-xs font-semibold text-tinta-suave">
          Color en el mapa
          <input
            type="color"
            value={formulario.color}
            onChange={(evento) => {
              cambiar({ color: evento.target.value });
            }}
            className="mt-1 block h-10 w-20 cursor-pointer rounded-xl border border-borde bg-superficie p-1"
          />
        </label>
      </div>

      <Grupo
        titulo="Horario de cobro"
        ayuda="Fuera de estas franjas se estaciona gratis. Un horario que cruza la medianoche se carga como dos franjas."
      >
        {formulario.horario.map((franja, i) => (
          <div key={franja.clave} className="flex flex-wrap items-center gap-2">
            <div
              className="flex gap-1"
              role="group"
              aria-label={`Días de la franja ${String(i + 1)}`}
            >
              {DIAS.map(({ dia, letra }) => {
                const activo = franja.dias.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    aria-pressed={activo}
                    aria-label={NOMBRES_DE_DIAS[dia]}
                    onClick={() => {
                      cambiarFranja(i, {
                        dias: activo ? franja.dias.filter((d) => d !== dia) : [...franja.dias, dia],
                      });
                    }}
                    className={cn(
                      'grid size-9 place-items-center rounded-lg text-sm font-bold transition',
                      activo ? 'bg-marca text-sobre-marca' : 'bg-superficie-2 text-tinta-suave',
                    )}
                  >
                    {letra}
                  </button>
                );
              })}
            </div>
            <input
              type="time"
              aria-label="Desde"
              value={franja.desde}
              onChange={(evento) => {
                cambiarFranja(i, { desde: evento.target.value });
              }}
              className={cn(campo, 'w-28')}
            />
            <span className="text-tinta-tenue">a</span>
            <input
              type="time"
              aria-label="Hasta"
              value={franja.hasta}
              onChange={(evento) => {
                cambiarFranja(i, { hasta: evento.target.value });
              }}
              className={cn(campo, 'w-28')}
            />
            {formulario.horario.length > 1 && (
              <BotonQuitar
                etiqueta="Quitar franja"
                alQuitar={() => {
                  cambiar({ horario: formulario.horario.filter((_, j) => j !== i) });
                }}
              />
            )}
          </div>
        ))}
        <Boton
          variante="fantasma"
          tamano="chico"
          onClick={() => {
            cambiar({
              horario: [
                ...formulario.horario,
                { clave: nuevaClave(), dias: [6], desde: '08:00', hasta: '13:00' },
              ],
            });
          }}
        >
          <Plus className="size-4" aria-hidden /> Agregar franja
        </Boton>
      </Grupo>

      <Grupo
        titulo="Precio por hora"
        ayuda="Tramos progresivos: desde el minuto indicado de cada jornada se cobra el precio de ese tramo."
      >
        {formulario.tramos.map((tramo, i) => (
          <div key={tramo.clave} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <CampoNumerico
              etiqueta="Desde el minuto"
              valor={tramo.desdeMinuto}
              sufijo="min"
              alCambiar={(valor) => {
                cambiar({
                  tramos: formulario.tramos.map((t, j) =>
                    j === i ? { ...t, desdeMinuto: valor } : t,
                  ),
                });
              }}
            />
            <CampoNumerico
              etiqueta="Precio por hora"
              valor={tramo.precio}
              sufijo="$/h"
              alCambiar={(valor) => {
                cambiar({
                  tramos: formulario.tramos.map((t, j) => (j === i ? { ...t, precio: valor } : t)),
                });
              }}
            />
            {formulario.tramos.length > 1 ? (
              <BotonQuitar
                etiqueta="Quitar tramo"
                alQuitar={() => {
                  cambiar({ tramos: formulario.tramos.filter((_, j) => j !== i) });
                }}
              />
            ) : (
              <span className="size-10" />
            )}
          </div>
        ))}
        <Boton
          variante="fantasma"
          tamano="chico"
          onClick={() => {
            const ultimo = formulario.tramos.at(-1);
            cambiar({
              tramos: [
                ...formulario.tramos,
                {
                  clave: nuevaClave(),
                  desdeMinuto: String(Number(ultimo?.desdeMinuto ?? 0) + 60),
                  precio: ultimo?.precio ?? '',
                },
              ],
            });
          }}
        >
          <Plus className="size-4" aria-hidden /> Agregar tramo
        </Boton>
      </Grupo>

      <Grupo titulo="Reglas de cobro">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CampoNumerico
            etiqueta="Fracción"
            valor={formulario.fraccion}
            sufijo="min"
            alCambiar={(fraccion) => {
              cambiar({ fraccion });
            }}
          />
          <CampoNumerico
            etiqueta="Mínimo"
            valor={formulario.minimo}
            sufijo="min"
            alCambiar={(minimo) => {
              cambiar({ minimo });
            }}
          />
          <CampoNumerico
            etiqueta="Tolerancia"
            valor={formulario.tolerancia}
            sufijo="min"
            alCambiar={(tolerancia) => {
              cambiar({ tolerancia });
            }}
          />
          <CampoNumerico
            etiqueta="Tope por día (opcional)"
            valor={formulario.tope}
            sufijo="$"
            alCambiar={(tope) => {
              cambiar({ tope });
            }}
          />
        </div>
      </Grupo>

      <Grupo titulo="Feriados y días sin cobro">
        {formulario.feriados.map((feriado, i) => (
          <div key={feriado.clave} className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Fecha"
              value={feriado.fecha}
              onChange={(evento) => {
                cambiar({
                  feriados: formulario.feriados.map((f, j) =>
                    j === i ? { ...f, fecha: evento.target.value } : f,
                  ),
                });
              }}
              className={cn(campo, 'w-40')}
            />
            <input
              aria-label="Motivo"
              placeholder="Motivo"
              maxLength={120}
              value={feriado.motivo}
              onChange={(evento) => {
                cambiar({
                  feriados: formulario.feriados.map((f, j) =>
                    j === i ? { ...f, motivo: evento.target.value } : f,
                  ),
                });
              }}
              className={cn(campo, 'min-w-40 flex-1')}
            />
            {feriado.franjas.length > 0 && (
              <span className="text-xs text-tinta-suave">
                Cobro especial {feriado.franjas.map((f) => `${f.desde}–${f.hasta}`).join(', ')}
              </span>
            )}
            <BotonQuitar
              etiqueta="Quitar feriado"
              alQuitar={() => {
                cambiar({ feriados: formulario.feriados.filter((_, j) => j !== i) });
              }}
            />
          </div>
        ))}
        <Boton
          variante="fantasma"
          tamano="chico"
          onClick={() => {
            cambiar({
              feriados: [
                ...formulario.feriados,
                { clave: nuevaClave(), fecha: '', motivo: '', franjas: [] },
              ],
            });
          }}
        >
          <Plus className="size-4" aria-hidden /> Agregar feriado
        </Boton>
      </Grupo>

      <section className="rounded-control bg-superficie-2 p-4" aria-live="polite">
        {'error' in previa ? (
          <p className="flex gap-2 text-sm font-medium text-peligro">
            <TriangleAlert className="size-5 shrink-0" aria-hidden />
            {previa.error}
          </p>
        ) : (
          <>
            <p className="text-xs font-bold tracking-wider text-tinta-tenue uppercase">
              Así pagaría un conductor · {previa.dia} desde las {previa.desde}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {previa.importes.map(({ duracion, importe }) => (
                <div key={duracion} className="rounded-xl bg-superficie px-3 py-2">
                  <dt className="text-xs text-tinta-suave">
                    {duracion < 60 ? `${String(duracion)} min` : `${String(duracion / 60)} h`}
                  </dt>
                  <dd className="cifras font-extrabold">{pesos(importe)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" onClick={alTerminar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={guardar.isPending} disabled={'error' in previa}>
          {zona ? 'Guardar tarifa' : 'Crear zona'}
        </Boton>
      </div>
    </form>
  );
}
