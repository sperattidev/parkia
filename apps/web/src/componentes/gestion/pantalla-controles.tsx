'use client';

import type { ResultadoDeControl } from '@parkia/contracts';
import { useSearchParams } from 'next/navigation';

import { TEXTOS_DE_RESULTADO, TONOS_DE_RESULTADO } from '@/componentes/agente/piezas';
import { patenteLegible } from '@/componentes/placa';
import { Esqueleto, Etiqueta } from '@/componentes/ui';
import { fechaCorta, hora } from '@/lib/formato';
import {
  consulta,
  enlaceDeExportacion,
  useControles,
  usePeriodo,
  usePersonal,
} from '@/lib/gestion';

import { useGestion } from './contexto';
import { BuscadorDePatente, selectorDeFiltro } from './pantalla-estacionamientos';
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

const RESULTADOS = Object.keys(TEXTOS_DE_RESULTADO) as ResultadoDeControl[];

export function PantallaControles() {
  const { municipio } = useGestion();
  const zh = municipio.zonaHoraria;
  const parametros = useSearchParams();
  const [periodo, cambiar] = usePeriodo(zh);
  const personal = usePersonal(municipio.slug);

  const filtro = {
    patente: parametros.get('patente') ?? '',
    resultado: parametros.get('resultado') ?? '',
    agenteId: parametros.get('agenteId') ?? '',
  };
  const pagina = Number(parametros.get('pagina') ?? '1');
  const q = consulta({ ...periodo, ...filtro });
  const lista = useControles(municipio.slug, `${q}&pagina=${String(pagina)}`);
  const filtrar = (extra: Record<string, string>) => {
    cambiar(periodo, { ...extra, pagina: '' });
  };

  return (
    <ContenidoDeGestion>
      <EncabezadoDeSeccion
        titulo="Controles"
        descripcion="Cada verificación de los agentes, con resultado, cuadra y precisión del GPS."
        accion={<BotonExportar href={enlaceDeExportacion(municipio.slug, 'controles', q)} />}
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
          aria-label="Resultado"
          value={filtro.resultado}
          onChange={(evento) => {
            filtrar({ resultado: evento.target.value });
          }}
          className={selectorDeFiltro}
        >
          <option value="">Todos los resultados</option>
          {RESULTADOS.map((resultado) => (
            <option key={resultado} value={resultado}>
              {TEXTOS_DE_RESULTADO[resultado]}
            </option>
          ))}
        </select>
        <select
          aria-label="Agente"
          value={filtro.agenteId}
          onChange={(evento) => {
            filtrar({ agenteId: evento.target.value });
          }}
          className={selectorDeFiltro}
        >
          <option value="">Todo el personal</option>
          {personal.data?.map((persona) => (
            <option key={persona.usuarioId} value={persona.usuarioId}>
              {persona.nombre ?? persona.email}
            </option>
          ))}
        </select>
      </div>

      {!lista.data ? (
        <Esqueleto className="h-96 rounded-tarjeta" />
      ) : (
        <div className={lista.isPlaceholderData ? 'space-y-3 opacity-60' : 'space-y-3'}>
          <MarcoDeTabla>
            <thead>
              <tr>
                <th className={celdaDeEncabezado}>Fecha y hora</th>
                <th className={celdaDeEncabezado}>Patente</th>
                <th className={celdaDeEncabezado}>Resultado</th>
                <th className={celdaDeEncabezado}>Lugar</th>
                <th className={celdaDeEncabezado}>Agente</th>
                <th className={`${celdaDeEncabezado} text-right`}>GPS</th>
              </tr>
            </thead>
            <tbody>
              {lista.data.elementos.length === 0 && (
                <tr>
                  <td colSpan={6} className={`${celda} py-10 text-center text-tinta-suave`}>
                    No hay controles con estos filtros.
                  </td>
                </tr>
              )}
              {lista.data.elementos.map((fila) => (
                <tr key={fila.id} className="hover:bg-superficie-2/60">
                  <td className={`${celda} cifras whitespace-nowrap`}>
                    {fechaCorta(fila.registradoEn, zh)} · {hora(fila.registradoEn, zh)}
                  </td>
                  <td className={`${celda} font-mono font-bold tracking-wider whitespace-nowrap`}>
                    {patenteLegible(fila.patente)}
                  </td>
                  <td className={celda}>
                    <Etiqueta tono={TONOS_DE_RESULTADO[fila.resultado]}>
                      {TEXTOS_DE_RESULTADO[fila.resultado]}
                    </Etiqueta>
                  </td>
                  <td className={celda}>
                    {fila.calle ?? '—'}
                    {fila.zona && (
                      <span className="block text-xs text-tinta-tenue">{fila.zona}</span>
                    )}
                  </td>
                  <td className={celda}>{fila.agente.nombre}</td>
                  <td className={`${celda} cifras text-right whitespace-nowrap text-tinta-suave`}>
                    {fila.precisionMetros === null
                      ? 'Manual'
                      : `±${String(fila.precisionMetros)} m`}
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
