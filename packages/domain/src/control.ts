import { diaLocal, instanteLocal } from './tarifas/calendario.js';

/** Con menos de este margen el vehículo figura como «por vencer». */
export const MINUTOS_POR_VENCER = 10;

/**
 * Vencidos que el agente ve en el radar y en el padrón de la cuadra. Pasado
 * este tiempo lo más probable es que el vehículo ya no esté.
 */
export const MINUTOS_DE_VENCIDOS_RECIENTES = 120;

export type ResultadoDeControl =
  | 'habilitado'
  | 'fuera_de_horario'
  | 'sin_estacionamiento'
  | 'vencido'
  | 'otra_zona'
  | 'fuera_de_zona';

export type Situacion = 'vigente' | 'por_vencer' | 'vencido';

export type Coincidencia = 'misma_cuadra' | 'cuadra_cercana' | 'otra_cuadra';

/** Cuadra cercana al agente y la zona a la que pertenece. */
export interface CuadraCercana {
  readonly id: string;
  readonly zonaId: string;
}

/** Último estacionamiento de la patente en la jornada (en curso o vencido). */
export interface EstacionamientoControlado {
  readonly zonaId: string;
  readonly cuadraId: string | null;
  readonly venceEn: Date;
}

export interface SituacionDeControl {
  /** Zona de la cuadra donde está el agente, o nula si no está sobre una cuadra paga. */
  readonly zonaId: string | null;
  readonly enHorarioDeCobro: boolean;
  /** Cuadras a distancia de control del agente, incluida la suya. */
  readonly cercanas: readonly CuadraCercana[];
  readonly estacionamiento: EstacionamientoControlado | null;
  readonly ahora: Date;
}

/**
 * Decide si un vehículo puede estar estacionado donde lo encuentra el agente.
 * Orden: cuadra tarifada, horario de cobro, estacionamiento vigente y zona.
 *
 * La zona se valida contra todas las cuadras cercanas y no solo la más
 * próxima: en una esquina donde se tocan dos zonas el agente puede estar más
 * cerca de la cuadra de la otra zona que de la del vehículo.
 */
export function evaluarControl(situacion: SituacionDeControl): ResultadoDeControl {
  const { zonaId, enHorarioDeCobro, cercanas, estacionamiento, ahora } = situacion;
  if (!zonaId) return 'fuera_de_zona';
  if (!enHorarioDeCobro) return 'fuera_de_horario';
  if (!estacionamiento) return 'sin_estacionamiento';
  if (estacionamiento.venceEn <= ahora) return 'vencido';
  const zonasCercanas = new Set([zonaId, ...cercanas.map((cuadra) => cuadra.zonaId)]);
  return zonasCercanas.has(estacionamiento.zonaId) ? 'habilitado' : 'otra_zona';
}

/** Coincidencia entre la cuadra declarada por el conductor y la del agente. */
export function coincidencia(
  cuadraDeclarada: string | null,
  cuadraDelAgente: string | null,
  cercanas: readonly CuadraCercana[],
): Coincidencia | null {
  if (!cuadraDeclarada || !cuadraDelAgente) return null;
  if (cuadraDeclarada === cuadraDelAgente) return 'misma_cuadra';
  return cercanas.some((cuadra) => cuadra.id === cuadraDeclarada)
    ? 'cuadra_cercana'
    : 'otra_cuadra';
}

export function situacion(venceEn: Date, ahora: Date): Situacion {
  const restante = venceEn.getTime() - ahora.getTime();
  if (restante <= 0) return 'vencido';
  return restante < MINUTOS_POR_VENCER * 60_000 ? 'por_vencer' : 'vigente';
}

/** Medianoche local del día en que cae el instante: inicio de la jornada de control. */
export function inicioDelDia(instante: Date, zonaHoraria: string): Date {
  return new Date(instanteLocal(diaLocal(instante, zonaHoraria), 0, zonaHoraria));
}
