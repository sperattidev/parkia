'use client';

import type { EntradaDeAuditoria } from '@parkia/contracts';
import { History } from 'lucide-react';
import { useState } from 'react';

import { EstadoVacio, Esqueleto } from '@/componentes/ui';
import { fechaCorta, hora, pesosRedondos } from '@/lib/formato';
import { useAuditoria, useCuadras, usePersonal, useZonas } from '@/lib/gestion';

import { useGestion } from './contexto';
import { ContenidoDeGestion, EncabezadoDeSeccion, Paginacion } from './piezas';

type Nombres = (entidad: string, id: string) => string;

const ROLES: Record<string, string> = { admin: 'administración', agente: 'agente de control' };

function primerPrecio(valor: unknown): number | undefined {
  const regla = (valor as { reglaTarifaria?: { tramos?: { precioHora?: number }[] } } | null)
    ?.reglaTarifaria;
  return regla?.tramos?.[0]?.precioHora;
}

/** Descripción en una línea, como la contaría una persona. */
function describir(entrada: EntradaDeAuditoria, nombre: Nombres): string {
  const sujeto = nombre(entrada.entidad, entrada.entidadId);
  const despues = (entrada.despues ?? {}) as Record<string, unknown>;
  switch (entrada.accion) {
    case 'zona.alta':
      return `Creó la zona ${typeof despues.nombre === 'string' ? despues.nombre : sujeto}`;
    case 'zona.tarifa': {
      const antes = primerPrecio(entrada.antes);
      const ahora = primerPrecio(entrada.despues);
      return antes !== undefined && ahora !== undefined && antes !== ahora
        ? `Cambió la tarifa de ${sujeto}: ${pesosRedondos(antes)}/h → ${pesosRedondos(ahora)}/h`
        : `Cambió la tarifa de ${sujeto}`;
    }
    case 'zona.cambio':
      if (despues.activa === false) return `Desactivó la zona ${sujeto}`;
      if (despues.activa === true) return `Activó la zona ${sujeto}`;
      return `Modificó la zona ${sujeto}`;
    case 'cuadra.cambio':
      if ('zonaId' in despues) {
        return typeof despues.zonaId === 'string'
          ? `Asignó ${sujeto} a ${nombre('zona', despues.zonaId)}`
          : `Sacó ${sujeto} de su zona`;
      }
      return `Cambió la capacidad o el estado de ${sujeto}`;
    case 'personal.alta':
      return `Dio de alta a ${sujeto} como ${ROLES[String(despues.rol)] ?? String(despues.rol)}`;
    case 'personal.baja':
      return `Dio de baja a ${sujeto}`;
    case 'personal.cambio':
      return typeof despues.rol === 'string'
        ? `Cambió el rol de ${sujeto} a ${ROLES[despues.rol] ?? despues.rol}`
        : `Reactivó a ${sujeto}`;
    case 'personal.restablecimiento':
      return `Restableció la contraseña de ${sujeto}`;
    case 'municipio.alta':
      return 'Dio de alta el municipio en Parkia';
    case 'municipio.cambio':
      return 'Modificó los datos del municipio';
    default:
      return `${entrada.accion} · ${sujeto}`;
  }
}

function Entrada({ entrada, nombre }: { entrada: EntradaDeAuditoria; nombre: Nombres }) {
  const { municipio } = useGestion();
  const [abierta, setAbierta] = useState(false);
  const hayDetalle = entrada.antes !== null || entrada.despues !== null;
  return (
    <li className="flex gap-4 px-5 py-4">
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-marca" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{describir(entrada, nombre)}</p>
        <p className="cifras mt-0.5 text-xs text-tinta-tenue">
          {entrada.usuario.nombre ?? entrada.usuario.email} ·{' '}
          {fechaCorta(entrada.creadoEn, municipio.zonaHoraria)} ·{' '}
          {hora(entrada.creadoEn, municipio.zonaHoraria)}
        </p>
        {hayDetalle && (
          <button
            type="button"
            aria-expanded={abierta}
            onClick={() => {
              setAbierta(!abierta);
            }}
            className="mt-1 text-xs font-semibold text-marca"
          >
            {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        )}
        {abierta && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(['antes', 'despues'] as const).map((clave) => (
              <div key={clave}>
                <p className="mb-1 text-xs font-bold text-tinta-tenue uppercase">
                  {clave === 'antes' ? 'Antes' : 'Después'}
                </p>
                <pre className="max-h-64 overflow-auto rounded-xl bg-superficie-2 p-3 text-xs">
                  {entrada[clave] === null ? '—' : JSON.stringify(entrada[clave], null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export function PantallaAuditoria() {
  const { municipio } = useGestion();
  const [pagina, setPagina] = useState(1);
  const auditoria = useAuditoria(municipio.slug, pagina);
  const zonas = useZonas(municipio.slug);
  const cuadras = useCuadras(municipio.slug);
  const personal = usePersonal(municipio.slug);

  const nombre: Nombres = (entidad, id) => {
    if (entidad === 'zona') return zonas.data?.find((z) => z.id === id)?.nombre ?? 'una zona';
    if (entidad === 'cuadra') {
      const cuadra = cuadras.data?.features.find((c) => c.id === id);
      return cuadra
        ? `${cuadra.properties.calle} ${String(cuadra.properties.alturaDesde)}–${String(cuadra.properties.alturaHasta)}`
        : 'una cuadra';
    }
    if (entidad === 'usuario') {
      const persona = personal.data?.find((p) => p.usuarioId === id);
      return persona ? (persona.nombre ?? persona.email) : 'una persona';
    }
    return entidad;
  };

  return (
    <ContenidoDeGestion>
      <EncabezadoDeSeccion
        titulo="Auditoría"
        descripcion="Cada cambio de tarifas, zonas, cuadras y personal, con quién lo hizo y cuándo. El registro no se puede modificar ni borrar."
      />
      {!auditoria.data ? (
        <Esqueleto className="h-96 rounded-tarjeta" />
      ) : auditoria.data.total === 0 ? (
        <EstadoVacio
          Icono={History}
          titulo="Todavía no hay cambios"
          descripcion="Cuando alguien cambie una tarifa, una cuadra o el personal, va a quedar registrado acá."
        />
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-borde rounded-tarjeta bg-superficie shadow-tarjeta">
            {auditoria.data.elementos.map((entrada) => (
              <Entrada key={entrada.id} entrada={entrada} nombre={nombre} />
            ))}
          </ul>
          <Paginacion
            pagina={auditoria.data.pagina}
            porPagina={auditoria.data.porPagina}
            total={auditoria.data.total}
            alCambiar={setPagina}
          />
        </div>
      )}
    </ContenidoDeGestion>
  );
}
