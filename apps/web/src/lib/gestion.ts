'use client';

import type {
  CredencialTemporal,
  CuadrasDeGestion,
  EntradaDeAuditoria,
  FilaDeControl,
  FilaDeEstacionamiento,
  ListaPaginada,
  Persona,
  ResumenDeGestion,
  ZonaDeGestion,
} from '@parkia/contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { api } from './cliente';

export interface Periodo {
  readonly desde: string;
  readonly hasta: string;
}

/** Fecha local `YYYY-MM-DD` en la zona horaria dada. */
export function fechaEn(instante: Date, zonaHoraria: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(instante);
}

export function restarDias(fecha: string, dias: number): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia - dias)).toISOString().slice(0, 10);
}

/** Atajos de período que usa un municipio: hoy, la última semana, el último mes, este mes. */
export function periodosRapidos(zonaHoraria: string, ahora = new Date()) {
  const hoy = fechaEn(ahora, zonaHoraria);
  return [
    { clave: 'hoy', texto: 'Hoy', desde: hoy, hasta: hoy },
    { clave: '7', texto: '7 días', desde: restarDias(hoy, 6), hasta: hoy },
    { clave: '30', texto: '30 días', desde: restarDias(hoy, 29), hasta: hoy },
    { clave: 'mes', texto: 'Este mes', desde: `${hoy.slice(0, 8)}01`, hasta: hoy },
  ] as const;
}

/**
 * Período elegido, guardado en la URL (`?desde=&hasta=`) para que un reporte
 * se pueda compartir tal como se ve. Por defecto, los últimos 30 días.
 */
export function usePeriodo(zonaHoraria: string) {
  const parametros = useSearchParams();
  const router = useRouter();
  const ruta = usePathname();
  // La fecha de hoy se fija al montar: el render tiene que ser puro.
  const [hoy] = useState(() => fechaEn(new Date(), zonaHoraria));
  const periodo: Periodo = {
    desde: parametros.get('desde') ?? restarDias(hoy, 29),
    hasta: parametros.get('hasta') ?? hoy,
  };
  const cambiar = useCallback(
    (nuevo: Periodo, extra: Record<string, string> = {}) => {
      const siguiente = new URLSearchParams(parametros);
      siguiente.set('desde', nuevo.desde);
      siguiente.set('hasta', nuevo.hasta);
      for (const [clave, valor] of Object.entries(extra)) {
        if (valor) siguiente.set(clave, valor);
        else siguiente.delete(clave);
      }
      router.replace(`${ruta}?${siguiente.toString()}` as Parameters<typeof router.replace>[0], {
        scroll: false,
      });
    },
    [parametros, router, ruta],
  );
  return [periodo, cambiar] as const;
}

/** Arma la query string omitiendo los filtros vacíos. */
export function consulta(valores: Record<string, string | number | undefined>): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== undefined && valor !== '') parametros.set(clave, String(valor));
  }
  return parametros.toString();
}

const claves = {
  todo: (m: string) => ['gestion', m] as const,
  resumen: (m: string, p: Periodo) => ['gestion', m, 'resumen', p.desde, p.hasta] as const,
  listado: (m: string, tipo: string, q: string) => ['gestion', m, tipo, q] as const,
  zonas: (m: string) => ['gestion', m, 'zonas'] as const,
  cuadras: (m: string) => ['gestion', m, 'cuadras'] as const,
  personal: (m: string) => ['gestion', m, 'personal'] as const,
  auditoria: (m: string, pagina: number) => ['gestion', m, 'auditoria', pagina] as const,
};

const ruta = (municipio: string, resto: string) => `municipios/${municipio}/gestion/${resto}`;

export function useResumen(municipio: string, periodo: Periodo) {
  return useQuery({
    queryKey: claves.resumen(municipio, periodo),
    queryFn: () => api<ResumenDeGestion>(ruta(municipio, `resumen?${consulta({ ...periodo })}`)),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useEstacionamientos(municipio: string, q: string) {
  return useQuery({
    queryKey: claves.listado(municipio, 'estacionamientos', q),
    queryFn: () =>
      api<ListaPaginada<FilaDeEstacionamiento>>(ruta(municipio, `estacionamientos?${q}`)),
    placeholderData: keepPreviousData,
  });
}

export function useControles(municipio: string, q: string) {
  return useQuery({
    queryKey: claves.listado(municipio, 'controles', q),
    queryFn: () => api<ListaPaginada<FilaDeControl>>(ruta(municipio, `controles?${q}`)),
    placeholderData: keepPreviousData,
  });
}

/** Enlace de descarga del CSV (lo sirve el proxy de la web con la sesión del usuario). */
export function enlaceDeExportacion(
  municipio: string,
  tipo: 'estacionamientos' | 'controles',
  q: string,
) {
  return `/api/parkia/${ruta(municipio, `exportaciones/${tipo}?${q}`)}`;
}

export function useZonas(municipio: string) {
  return useQuery({
    queryKey: claves.zonas(municipio),
    queryFn: () => api<ZonaDeGestion[]>(ruta(municipio, 'zonas')),
  });
}

export function useCuadras(municipio: string, refrescoMs?: number) {
  return useQuery({
    queryKey: claves.cuadras(municipio),
    queryFn: () => api<CuadrasDeGestion>(ruta(municipio, 'cuadras')),
    ...(refrescoMs && { refetchInterval: refrescoMs }),
  });
}

export function usePersonal(municipio: string) {
  return useQuery({
    queryKey: claves.personal(municipio),
    queryFn: () => api<Persona[]>(ruta(municipio, 'personal')),
  });
}

export function useAuditoria(municipio: string, pagina: number) {
  return useQuery({
    queryKey: claves.auditoria(municipio, pagina),
    queryFn: () =>
      api<ListaPaginada<EntradaDeAuditoria>>(ruta(municipio, `auditoria?pagina=${String(pagina)}`)),
    placeholderData: keepPreviousData,
  });
}

/** Mutación del panel: al terminar, refresca todo lo del municipio (y la auditoría). */
function useCambio<Entrada, Salida>(
  municipio: string,
  enviar: (entrada: Entrada) => Promise<Salida>,
) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: enviar,
    onSuccess: () => cliente.invalidateQueries({ queryKey: claves.todo(municipio) }),
  });
}

export function useGuardarZona(municipio: string) {
  return useCambio(municipio, ({ id, ...datos }: { id?: string } & Record<string, unknown>) =>
    api<ZonaDeGestion>(ruta(municipio, id ? `zonas/${id}` : 'zonas'), {
      metodo: id ? 'PATCH' : 'POST',
      cuerpo: datos,
    }),
  );
}

export function useCambiarCuadra(municipio: string) {
  return useCambio(municipio, ({ id, ...cambio }: { id: string } & Record<string, unknown>) =>
    api<CuadrasDeGestion>(ruta(municipio, `cuadras/${id}`), { metodo: 'PATCH', cuerpo: cambio }),
  );
}

export function useAltaDePersona(municipio: string) {
  return useCambio(municipio, (datos: { email: string; nombre: string; rol: string }) =>
    api<CredencialTemporal>(ruta(municipio, 'personal'), { metodo: 'POST', cuerpo: datos }),
  );
}

export function useCambiarPersona(municipio: string) {
  return useCambio(
    municipio,
    ({ usuarioId, ...cambio }: { usuarioId: string; rol?: string; activo?: boolean }) =>
      api<Persona>(ruta(municipio, `personal/${usuarioId}`), { metodo: 'PATCH', cuerpo: cambio }),
  );
}

export function useRestablecer(municipio: string) {
  return useCambio(municipio, (usuarioId: string) =>
    api<CredencialTemporal>(ruta(municipio, `personal/${usuarioId}/restablecimientos`), {
      metodo: 'POST',
    }),
  );
}
