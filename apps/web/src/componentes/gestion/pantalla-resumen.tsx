'use client';

import type { ResumenDeGestion } from '@parkia/contracts';

import { Esqueleto } from '@/componentes/ui';
import { pesos, pesosRedondos } from '@/lib/formato';
import { usePeriodo, useResumen } from '@/lib/gestion';

import { useGestion } from './contexto';
import {
  ContenidoDeGestion,
  EncabezadoDeSeccion,
  GraficoDeBarras,
  Indicador,
  SelectorDePeriodo,
} from './piezas';

const porcentaje = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

function diaCorto(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return `${dia ?? ''}/${mes ?? ''}`;
}

function TarjetaDeGrafico({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="font-extrabold">{titulo}</h2>
        {detalle && <p className="cifras text-sm text-tinta-suave">{detalle}</p>}
      </div>
      {children}
    </section>
  );
}

function PorZona({ resumen }: { resumen: ResumenDeGestion }) {
  return (
    <TarjetaDeGrafico titulo="Por zona">
      <ul className="space-y-4">
        {resumen.porZona.map(({ zona, recaudado, estacionamientos, capacidad, ocupadosAhora }) => {
          const ocupacion = porcentaje(ocupadosAhora, capacidad);
          return (
            <li key={zona.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-2 font-bold">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: zona.color }}
                    aria-hidden
                  />
                  {zona.nombre}
                </p>
                <p className="cifras font-bold">{pesosRedondos(recaudado)}</p>
              </div>
              <p className="cifras mt-0.5 text-xs text-tinta-suave">
                {estacionamientos.toLocaleString('es-AR')} estacionamientos · ahora {ocupadosAhora}{' '}
                de {capacidad} lugares ({ocupacion} %)
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-superficie-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${String(ocupacion)}%`, backgroundColor: zona.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </TarjetaDeGrafico>
  );
}

export function PantallaResumen() {
  const { municipio } = useGestion();
  const [periodo, setPeriodo] = usePeriodo(municipio.zonaHoraria);
  const resumen = useResumen(municipio.slug, periodo);
  const datos = resumen.data;

  const horaPico = datos
    ? datos.porHora.reduce((pico, hora) =>
        hora.estacionamientos > pico.estacionamientos ? hora : pico,
      )
    : undefined;

  return (
    <ContenidoDeGestion>
      <EncabezadoDeSeccion
        titulo="Resumen"
        descripcion="Lo recaudado se cuenta el día en que termina cada estacionamiento; la cantidad, el día en que empieza."
        accion={
          <SelectorDePeriodo
            periodo={periodo}
            alCambiar={(nuevo) => {
              setPeriodo(nuevo);
            }}
          />
        }
      />

      {!datos ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-32 rounded-tarjeta" />
          ))}
          <Esqueleto className="h-64 rounded-tarjeta sm:col-span-2 xl:col-span-4" />
        </div>
      ) : (
        <div className={resumen.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              etiqueta="Recaudado"
              valor={pesosRedondos(datos.recaudado)}
              tono="marca"
              detalle={`Saldo cargado: ${pesosRedondos(datos.cargas)}`}
            />
            <Indicador
              etiqueta="Estacionamientos"
              valor={datos.estacionamientos.toLocaleString('es-AR')}
              detalle={`${String(datos.minutosPromedio)} min de duración promedio`}
            />
            <Indicador
              etiqueta="Ocupación ahora"
              valor={`${String(porcentaje(datos.ahora.activos, datos.ahora.capacidad))} %`}
              detalle={`${String(datos.ahora.activos)} de ${String(datos.ahora.capacidad)} lugares pagos`}
            />
            <Indicador
              etiqueta="Controles"
              valor={datos.controles.toLocaleString('es-AR')}
              tono={datos.infracciones > 0 ? 'peligro' : undefined}
              detalle={
                datos.controles > 0
                  ? `${String(datos.infracciones)} infracciones · ${String(100 - porcentaje(datos.infracciones, datos.controles))} % en regla`
                  : 'Sin controles en el período'
              }
            />
          </div>

          <div className="mt-4">
            <TarjetaDeGrafico
              titulo="Recaudación por día"
              detalle={`Total ${pesos(datos.recaudado)}`}
            >
              <GraficoDeBarras
                barras={datos.porDia.map((dia) => ({
                  clave: dia.fecha,
                  etiqueta: diaCorto(dia.fecha),
                  valor: dia.recaudado,
                  descripcion: `${diaCorto(dia.fecha)}: ${pesosRedondos(dia.recaudado)} · ${String(dia.estacionamientos)} estacionamientos`,
                }))}
                etiquetasCada={Math.ceil(datos.porDia.length / 8)}
              />
            </TarjetaDeGrafico>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <PorZona resumen={datos} />
            <TarjetaDeGrafico
              titulo="Horas de más uso"
              {...(horaPico &&
                horaPico.estacionamientos > 0 && {
                  detalle: `Pico: ${String(horaPico.hora)} a ${String(horaPico.hora + 1)} h`,
                })}
            >
              <GraficoDeBarras
                alto={150}
                barras={datos.porHora.map((hora) => ({
                  clave: String(hora.hora),
                  etiqueta: String(hora.hora),
                  valor: hora.estacionamientos,
                  descripcion: `${String(hora.hora)} a ${String(hora.hora + 1)} h: ${String(hora.estacionamientos)} estacionamientos iniciados`,
                }))}
                etiquetasCada={3}
                resaltar={(barra) => barra.clave === String(horaPico?.hora)}
              />
            </TarjetaDeGrafico>
          </div>
        </div>
      )}
    </ContenidoDeGestion>
  );
}
