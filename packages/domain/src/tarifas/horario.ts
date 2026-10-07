import { ErrorDeDominio } from '../errores.js';
import { diaLocal, intervalosDeCobro } from './calendario.js';
import type { ReglaTarifaria } from './tipos.js';
import { validarReglaTarifaria } from './validar.js';

/** Indica si en un instante dado se cobra estacionamiento en la zona. */
export function estaEnHorarioDeCobro(regla: ReglaTarifaria, instante: Date): boolean {
  validarReglaTarifaria(regla);
  const momento = instante.getTime();
  if (Number.isNaN(momento)) {
    throw new ErrorDeDominio('FECHA_INVALIDA', 'La fecha consultada no es válida.');
  }
  return intervalosDeCobro(regla, diaLocal(instante, regla.zonaHoraria)).some(
    ([desde, hasta]) => desde <= momento && momento < hasta,
  );
}
