import type { Centavos } from '../dinero.js';

/** Día de la semana con la convención de JavaScript: 0 = domingo … 6 = sábado. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Hora local en formato `HH:mm` (24 h). `24:00` solo es válido como fin de franja. */
export type HoraLocal = `${number}:${number}`;

/** Fecha local en formato `YYYY-MM-DD`. */
export type FechaLocal = `${number}-${number}-${number}`;

/** Intervalo horario semiabierto `[desde, hasta)` en hora local. */
export interface Franja {
  readonly desde: HoraLocal;
  readonly hasta: HoraLocal;
}

/** Franja de cobro que se repite los días de la semana indicados. */
export interface FranjaSemanal extends Franja {
  readonly dias: readonly DiaSemana[];
}

/**
 * Día con horario distinto al habitual (feriado, evento especial).
 * Sin franjas significa que ese día no se cobra.
 */
export interface DiaEspecial {
  readonly fecha: FechaLocal;
  readonly franjas: readonly Franja[];
  readonly motivo?: string;
}

/**
 * Tramo de una tarifa progresiva. Rige para cada fracción cuyo inicio, medido en
 * minutos cobrables transcurridos dentro de la jornada, sea mayor o igual a
 * `desdeMinuto` (y menor al `desdeMinuto` del tramo siguiente).
 */
export interface Tramo {
  readonly desdeMinuto: number;
  readonly precioHora: Centavos;
}

/**
 * Configuración tarifaria de una zona. Cada jornada (día local) se liquida por
 * separado: la progresividad, la tolerancia, el mínimo y el tope se aplican por
 * jornada.
 */
export interface ReglaTarifaria {
  /** Zona horaria IANA del municipio, por ejemplo `America/Argentina/Buenos_Aires`. */
  readonly zonaHoraria: string;
  readonly horario: readonly FranjaSemanal[];
  readonly diasEspeciales?: readonly DiaEspecial[];
  /** Unidad de cobro en minutos: el tiempo se redondea hacia arriba a esta fracción. */
  readonly fraccionMinutos: number;
  /** Tiempo mínimo facturado por jornada (múltiplo de la fracción). */
  readonly minimoMinutos: number;
  /** Si el tiempo cobrable de la jornada no supera este valor, no se cobra. */
  readonly toleranciaMinutos: number;
  readonly tramos: readonly Tramo[];
  readonly topePorJornada?: Centavos;
}

export interface PeriodoEstacionamiento {
  readonly inicio: Date;
  readonly fin: Date;
}

export interface LiquidacionJornada {
  readonly fecha: FechaLocal;
  /** Minutos efectivamente estacionados dentro del horario de cobro (redondeo hacia arriba). */
  readonly minutosCobrables: number;
  /** Minutos facturados tras aplicar fracción y mínimo. 0 si quedó dentro de la tolerancia. */
  readonly minutosFacturados: number;
  readonly enTolerancia: boolean;
  readonly importeSinTope: Centavos;
  readonly aplicoTope: boolean;
  readonly importe: Centavos;
}

export interface Liquidacion {
  readonly importe: Centavos;
  readonly minutosCobrables: number;
  /** Solo jornadas con tiempo cobrable, en orden cronológico. */
  readonly jornadas: readonly LiquidacionJornada[];
}
