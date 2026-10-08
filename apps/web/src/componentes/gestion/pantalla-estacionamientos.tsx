'use client';

import { Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { patenteLegible } from '@/componentes/placa';
import { Esqueleto, Etiqueta } from '@/componentes/ui';
import { duracion, hora, fechaCorta, pesos } from '@/lib/formato';
import {
  consulta,
  enlaceDeExportacion,
  useEstacionamientos,
  usePeriodo,
  useZonas,
} from '@/lib/gestion';

import { useGestion } from './contexto';
import {
  BotonExportar,
  ContenidoDeGestion,
  EncabezadoDeSeccion,
  MarcoDeTabla,
  Paginacion,
  SelectorDePeriodo,
  celda,
  celdaDeEncabezado,
} from './piezas';

const MOTIVOS = {
  conductor: 'Finalizado',
  saldo_agotado: 'Saldo agotado',
  duracion_maxima: 'Duración máxima',
} as const;

export const selectorDeFiltro =
  'h-10 rounded-xl border border-borde bg-superficie px-3 text-sm font-semibold text-tinta focus:border-marca focus:outline-none';

/** Buscador de patente que filtra al confirmar (Enter o al salir del campo). */
export function BuscadorDePatente({
  valor,
  alBuscar,
}: {
  valor: string;
  alBuscar: (patente: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  return (
    <form
      role="search"
      onSubmit={(evento) => {
        evento.preventDefault();
        alBuscar(texto.trim());
      }}
      className="relative"
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-tenue"
        aria-hidden
      />
      <input
        type="search"
        aria-label="Buscar patente"
        placeholder="Patente"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value.toUpperCase());
        }}
        onBlur={() => {
          if (texto.trim() !== valor) alBuscar(texto.trim());
        }}
        className={`${selectorDeFiltro} w-36 pl-9 font-mono tracking-wider`}
      />
    </form>
  );
}

export function PantallaEstacionamientos() {
  const { municipio } = useGestion();
  const zh = municipio.zonaHoraria;
  const parametros = useSearchParams();
  const [periodo, cambiar] = usePeriodo(zh);
  const zonas = useZonas(municipio.slug);

  const filtro = {
    patente: parametros.get('patente') ?? '',
    zonaId: parametros.get('zonaId') ?? '',
    estado: parametros.get('estado') ?? '',
  };
  const pagina = Number(parametros.get('pagina') ?? '1');
  const q = consulta({ ...periodo, ...filtro });
  const lista = useEstacionamientos(municipio.slug, `${q}&pagina=${String(pagina)}`);
  const filtrar = (extra: Record<string, string>) => {
    cambiar(periodo, { ...extra, pagina: '' });
  };

  return (
    <ContenidoDeGestion>
      <EncabezadoDeSeccion
        titulo="Estacionamientos"
        descripcion="Cada estacionamiento con su ubicación declarada, duración e importe cobrado."
        accion={<BotonExportar href={enlaceDeExportacion(municipio.slug, 'estacionamientos', q)} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SelectorDePeriodo
          periodo={periodo}
          alCambiar={(nuevo) => {
            cambiar(nuevo, { pagina: '' });
          }}
        />
        <BuscadorDePatente
          key={filtro.patente}
          valor={filtro.patente}
          alBuscar={(patente) => {
            filtrar({ patente });
          }}
        />
        <select
          aria-label="Zona"
          value={filtro.zonaId}
          onChange={(evento) => {
            filtrar({ zonaId: evento.target.value });
          }}
          className={selectorDeFiltro}
        >
          <option value="">Todas las zonas</option>
          {zonas.data?.map((zona) => (
            <option key={zona.id} value={zona.id}>
              {zona.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Estado"
          value={filtro.estado}
          onChange={(evento) => {
            filtrar({ estado: evento.target.value });
          }}
          className={selectorDeFiltro}
        >
          <option value="">Todos</option>
          <option value="activo">En curso</option>
          <option value="finalizado">Finalizados</option>
        </select>
      </div>

      {!lista.data ? (
        <Esqueleto className="h-96 rounded-tarjeta" />
      ) : (
        <div className={lista.isPlaceholderData ? 'space-y-3 opacity-60' : 'space-y-3'}>
          <MarcoDeTabla>
            <thead>
              <tr>
                <th className={celdaDeEncabezado}>Inicio</th>
                <th className={celdaDeEncabezado}>Patente</th>
                <th className={celdaDeEncabezado}>Ubicación</th>
                <th className={celdaDeEncabezado}>Duración</th>
                <th className={`${celdaDeEncabezado} text-right`}>Importe</th>
                <th className={celdaDeEncabezado}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.data.elementos.length === 0 && (
                <tr>
                  <td colSpan={6} className={`${celda} py-10 text-center text-tinta-suave`}>
                    No hay estacionamientos con estos filtros.
                  </td>
                </tr>
              )}
              {lista.data.elementos.map((fila) => (
                <tr key={fila.id} className="hover:bg-superficie-2/60">
                  <td className={`${celda} cifras whitespace-nowrap`}>
                    {fechaCorta(fila.inicio, zh)} · {hora(fila.inicio, zh)}
                  </td>
                  <td className={`${celda} font-mono font-bold tracking-wider whitespace-nowrap`}>
                    {patenteLegible(fila.patente)}
                  </td>
                  <td className={celda}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: fila.zona.color }}
                        aria-hidden
                      />
                      <span>
                        {fila.direccion ?? fila.zona.nombre}
                        {fila.direccion && (
                          <span className="block text-xs text-tinta-tenue">{fila.zona.nombre}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className={`${celda} cifras whitespace-nowrap`}>
                    {duracion(fila.minutos * 60_000)}
                  </td>
                  <td className={`${celda} cifras text-right font-bold whitespace-nowrap`}>
                    {fila.estado === 'activo' ? '—' : pesos(fila.importe)}
                  </td>
                  <td className={celda}>
                    {fila.estado === 'activo' ? (
                      <Etiqueta tono="exito" punto>
                        En curso
                      </Etiqueta>
                    ) : (
                      <Etiqueta
                        tono={fila.motivoDeCierre === 'saldo_agotado' ? 'alerta' : 'neutro'}
                      >
                        {fila.motivoDeCierre ? MOTIVOS[fila.motivoDeCierre] : 'Finalizado'}
                      </Etiqueta>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </MarcoDeTabla>
          <Paginacion
            pagina={lista.data.pagina}
            porPagina={lista.data.porPagina}
            total={lista.data.total}
            alCambiar={(nueva) => {
              cambiar(periodo, { pagina: String(nueva) });
            }}
          />
        </div>
      )}
    </ContenidoDeGestion>
  );
}
