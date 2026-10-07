import { centavos, sumarCentavos, type Centavos } from '../dinero.js';
import { ErrorDeDominio } from '../errores.js';
import {
  MS_POR_MINUTO,
  compararDias,
  diaLocal,
  diaSiguiente,
  formatearFecha,
  intervalosDeCobro,
} from './calendario.js';
import type {
  FechaLocal,
  Liquidacion,
  LiquidacionJornada,
  PeriodoEstacionamiento,
  ReglaTarifaria,
  Tramo,
} from './tipos.js';
import { validarReglaTarifaria } from './validar.js';

/** Límite de seguridad: ningún estacionamiento se liquida por más de 31 días. */
export const DURACION_MAXIMA_MINUTOS = 31 * 24 * 60;

/** Horizonte por defecto para calcular vencimientos de saldo. */
const HORIZONTE_VENCIMIENTO_MINUTOS = 7 * 24 * 60;

function tramoVigente(tramos: readonly Tramo[], minuto: number): Tramo {
  let vigente = tramos[0];
  for (const tramo of tramos) {
    if (tramo.desdeMinuto > minuto) break;
    vigente = tramo;
  }
  if (!vigente) {
    throw new ErrorDeDominio('TRAMOS_VACIOS', 'La tarifa necesita al menos un tramo de precio.');
  }
  return vigente;
}

function liquidarJornada(
  regla: ReglaTarifaria,
  fecha: FechaLocal,
  minutosCobrables: number,
): LiquidacionJornada {
  if (minutosCobrables <= regla.toleranciaMinutos) {
    const cero = centavos(0);
    return {
      fecha,
      minutosCobrables,
      minutosFacturados: 0,
      enTolerancia: true,
      importeSinTope: cero,
      aplicoTope: false,
      importe: cero,
    };
  }

  const fraccion = regla.fraccionMinutos;
  const minutosFacturados = Math.max(
    regla.minimoMinutos,
    Math.ceil(minutosCobrables / fraccion) * fraccion,
  );

  // Cada fracción se cobra al precio del tramo en el que comienza.
  let total = 0;
  for (let inicio = 0; inicio < minutosFacturados; inicio += fraccion) {
    const { precioHora } = tramoVigente(regla.tramos, inicio);
    total += Math.round((precioHora * fraccion) / 60);
  }

  const importeSinTope = centavos(total);
  const tope = regla.topePorJornada;
  const aplicoTope = tope !== undefined && importeSinTope > tope;

  return {
    fecha,
    minutosCobrables,
    minutosFacturados,
    enTolerancia: false,
    importeSinTope,
    aplicoTope,
    importe: aplicoTope ? tope : importeSinTope,
  };
}

function milisegundos(fecha: Date, campo: string): number {
  const valor = fecha.getTime();
  if (Number.isNaN(valor)) {
    throw new ErrorDeDominio('FECHA_INVALIDA', `La fecha de ${campo} no es válida.`);
  }
  return valor;
}

function liquidarSinValidar(regla: ReglaTarifaria, periodo: PeriodoEstacionamiento): Liquidacion {
  const desde = milisegundos(periodo.inicio, 'inicio');
  const hasta = milisegundos(periodo.fin, 'fin');

  if (hasta < desde) {
    throw new ErrorDeDominio(
      'PERIODO_INVALIDO',
      'El fin del estacionamiento es anterior al inicio.',
    );
  }
  if (hasta - desde > DURACION_MAXIMA_MINUTOS * MS_POR_MINUTO) {
    throw new ErrorDeDominio(
      'PERIODO_DEMASIADO_LARGO',
      'El estacionamiento supera la duración máxima liquidable (31 días).',
    );
  }

  const jornadas: LiquidacionJornada[] = [];
  const ultimoDia = diaLocal(periodo.fin, regla.zonaHoraria);

  for (
    let dia = diaLocal(periodo.inicio, regla.zonaHoraria);
    compararDias(dia, ultimoDia) <= 0;
    dia = diaSiguiente(dia)
  ) {
    let msCobrables = 0;
    for (const [inicioFranja, finFranja] of intervalosDeCobro(regla, dia)) {
      msCobrables += Math.max(0, Math.min(finFranja, hasta) - Math.max(inicioFranja, desde));
    }
    if (msCobrables > 0) {
      // Un minuto empezado cuenta como minuto completo.
      const minutos = Math.ceil(msCobrables / MS_POR_MINUTO);
      jornadas.push(liquidarJornada(regla, formatearFecha(dia), minutos));
    }
  }

  return {
    importe: sumarCentavos(...jornadas.map((jornada) => jornada.importe)),
    minutosCobrables: jornadas.reduce((total, jornada) => total + jornada.minutosCobrables, 0),
    jornadas,
  };
}

/**
 * Calcula cuánto cuesta un estacionamiento. Solo se cobra el tiempo que cae
 * dentro del horario de cobro. Cada jornada se liquida por separado aplicando
 * tolerancia, redondeo a la fracción, mínimo, tramos progresivos y tope.
 */
export function liquidarEstacionamiento(
  regla: ReglaTarifaria,
  periodo: PeriodoEstacionamiento,
): Liquidacion {
  validarReglaTarifaria(regla);
  return liquidarSinValidar(regla, periodo);
}

/**
 * Último instante hasta el que un estacionamiento iniciado en `inicio` puede
 * mantenerse sin que su costo supere `saldo`. Devuelve `null` si el saldo
 * alcanza para todo el horizonte (por defecto, 7 días).
 */
export function calcularVencimiento(
  regla: ReglaTarifaria,
  inicio: Date,
  saldo: Centavos,
  horizonteMinutos: number = HORIZONTE_VENCIMIENTO_MINUTOS,
): Date | null {
  validarReglaTarifaria(regla);
  centavos(saldo);
  if (
    !Number.isSafeInteger(horizonteMinutos) ||
    horizonteMinutos <= 0 ||
    horizonteMinutos > DURACION_MAXIMA_MINUTOS
  ) {
    throw new ErrorDeDominio(
      'HORIZONTE_INVALIDO',
      `El horizonte debe ser un entero entre 1 y ${DURACION_MAXIMA_MINUTOS} minutos.`,
    );
  }

  const base = milisegundos(inicio, 'inicio');
  const costo = (minutos: number) =>
    liquidarSinValidar(regla, { inicio, fin: new Date(base + minutos * MS_POR_MINUTO) }).importe;

  if (costo(horizonteMinutos) <= saldo) {
    return null;
  }

  // El costo nunca decrece con el tiempo: búsqueda binaria del último minuto cubierto.
  let cubierto = 0;
  let excedido = horizonteMinutos;
  while (excedido - cubierto > 1) {
    const medio = Math.floor((cubierto + excedido) / 2);
    if (costo(medio) <= saldo) {
      cubierto = medio;
    } else {
      excedido = medio;
    }
  }
  return new Date(base + cubierto * MS_POR_MINUTO);
}
