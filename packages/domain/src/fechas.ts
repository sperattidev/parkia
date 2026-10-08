import {
  diaLocal,
  diaSiguiente,
  formatearFecha,
  instanteLocal,
  parsearFecha,
} from './tarifas/calendario.js';
import type { FechaLocal } from './tarifas/tipos.js';

/** Fecha de calendario (`YYYY-MM-DD`) en la que cae un instante en la zona horaria dada. */
export function fechaLocal(instante: Date, zonaHoraria: string): FechaLocal {
  return formatearFecha(diaLocal(instante, zonaHoraria));
}

/** Medianoche local de una fecha. */
export function inicioDeFecha(fecha: FechaLocal, zonaHoraria: string): Date {
  return new Date(instanteLocal(parsearFecha(fecha), 0, zonaHoraria));
}

export function sumarDias(fecha: FechaLocal, dias: number): FechaLocal {
  const { anio, mes, dia } = parsearFecha(fecha);
  const fechaUtc = new Date(Date.UTC(anio, mes, dia + dias));
  return formatearFecha({
    anio: fechaUtc.getUTCFullYear(),
    mes: fechaUtc.getUTCMonth(),
    dia: fechaUtc.getUTCDate(),
  });
}

/** Todas las fechas de `desde` a `hasta`, ambas incluidas. */
export function fechasEntre(desde: FechaLocal, hasta: FechaLocal): FechaLocal[] {
  const fechas: FechaLocal[] = [];
  let actual = parsearFecha(desde);
  const fin = parsearFecha(hasta);
  while (formatearFecha(actual) <= formatearFecha(fin)) {
    fechas.push(formatearFecha(actual));
    actual = diaSiguiente(actual);
  }
  return fechas;
}
