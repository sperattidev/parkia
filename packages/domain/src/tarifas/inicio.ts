import { centavos, type Centavos } from '../dinero.js';
import { ErrorDeDominio } from '../errores.js';
import { estaEnHorarioDeCobro } from './horario.js';
import { calcularVencimiento } from './liquidar.js';
import type { ReglaTarifaria } from './tipos.js';

/**
 * Decide si se puede iniciar un estacionamiento con el saldo disponible y
 * devuelve hasta cuándo queda cubierto (`null` = cubre todo el horizonte).
 *
 * Regla: si en este momento se cobra, el saldo tiene que comprar tiempo más
 * allá de la tolerancia (es decir, alcanzar al menos el mínimo). Fuera del
 * horario de cobro siempre se puede iniciar: el estacionamiento vence cuando
 * el saldo deja de cubrir el próximo período cobrado.
 */
export function vencimientoAlIniciar(
  regla: ReglaTarifaria,
  inicio: Date,
  saldo: Centavos,
): Date | null {
  const venceEn = calcularVencimiento(regla, inicio, saldo);
  if (!estaEnHorarioDeCobro(regla, inicio)) {
    return venceEn;
  }

  const sinSaldo = calcularVencimiento(regla, inicio, centavos(0));
  if (venceEn !== null && sinSaldo !== null && venceEn.getTime() <= sinSaldo.getTime()) {
    throw new ErrorDeDominio(
      'SALDO_INSUFICIENTE',
      'El saldo no alcanza para el tiempo mínimo de estacionamiento. Cargá saldo para continuar.',
    );
  }
  return venceEn;
}
