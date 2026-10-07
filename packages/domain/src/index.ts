export { ErrorDeDominio } from './errores.js';
export { centavos, formatearPesos, pesos, sumarCentavos, type Centavos } from './dinero.js';
export {
  esPatenteValida,
  formatoDePatente,
  normalizarPatente,
  type FormatoPatente,
  type Patente,
} from './patentes.js';

export { estaEnHorarioDeCobro } from './tarifas/horario.js';
export { vencimientoAlIniciar } from './tarifas/inicio.js';
export {
  DURACION_MAXIMA_MINUTOS,
  calcularVencimiento,
  liquidarEstacionamiento,
} from './tarifas/liquidar.js';
export type {
  DiaEspecial,
  DiaSemana,
  FechaLocal,
  Franja,
  FranjaSemanal,
  HoraLocal,
  Liquidacion,
  LiquidacionJornada,
  PeriodoEstacionamiento,
  ReglaTarifaria,
  Tramo,
} from './tarifas/tipos.js';
export { validarReglaTarifaria } from './tarifas/validar.js';
