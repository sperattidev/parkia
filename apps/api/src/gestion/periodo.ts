import { HttpStatus } from '@nestjs/common';
import { fechaLocal, inicioDeFecha, sumarDias, type FechaLocal } from '@parkia/domain';

import { ErrorDeApi } from '../comun/errores.js';

/** Un reporte abarca como máximo un año: más que eso se pide por partes. */
export const DIAS_MAXIMOS_DEL_PERIODO = 366;
const DIAS_POR_DEFECTO = 30;

export interface Periodo {
  readonly desde: FechaLocal;
  readonly hasta: FechaLocal;
  /** Medianoche local de `desde`. */
  readonly inicio: Date;
  /** Medianoche local del día siguiente a `hasta` (límite exclusivo). */
  readonly fin: Date;
}

/** Convierte fechas locales del municipio en instantes; por defecto, los últimos 30 días. */
export function resolverPeriodo(
  consulta: { desde?: string | undefined; hasta?: string | undefined },
  zonaHoraria: string,
  ahora: Date,
): Periodo {
  const hasta = (consulta.hasta ?? fechaLocal(ahora, zonaHoraria)) as FechaLocal;
  const desde = (consulta.desde ?? sumarDias(hasta, 1 - DIAS_POR_DEFECTO)) as FechaLocal;
  const inicio = inicioDeFecha(desde, zonaHoraria);
  const fin = inicioDeFecha(sumarDias(hasta, 1), zonaHoraria);
  const dias = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000);
  if (dias < 1 || dias > DIAS_MAXIMOS_DEL_PERIODO) {
    throw new ErrorDeApi(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'PERIODO_INVALIDO',
      `El período debe ir de una fecha a otra igual o posterior, con un máximo de ${String(DIAS_MAXIMOS_DEL_PERIODO)} días.`,
    );
  }
  return { desde, hasta, inicio, fin };
}
