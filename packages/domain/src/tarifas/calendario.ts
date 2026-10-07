import { TZDate } from '@date-fns/tz';

import { ErrorDeDominio } from '../errores.js';
import type { DiaSemana, FechaLocal, Franja, HoraLocal, ReglaTarifaria } from './tipos.js';

export const MS_POR_MINUTO = 60_000;
const MINUTOS_POR_DIA = 24 * 60;

/** Fecha de calendario sin zona horaria (mes 0-based, como en `Date`). */
export interface DiaCalendario {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
}

const PATRON_HORA = /^(\d{2}):(\d{2})$/;
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Minutos desde la medianoche. Acepta `24:00` (fin del día). */
export function minutosDesdeMedianoche(hora: HoraLocal): number {
  const coincidencia = PATRON_HORA.exec(hora);
  const horas = Number(coincidencia?.[1]);
  const minutos = Number(coincidencia?.[2]);
  const total = horas * 60 + minutos;
  if (!coincidencia || minutos > 59 || total > MINUTOS_POR_DIA) {
    throw new ErrorDeDominio('HORA_INVALIDA', `Hora inválida: "${hora}". Formato esperado HH:mm.`);
  }
  return total;
}

export function parsearFecha(fecha: FechaLocal): DiaCalendario {
  const coincidencia = PATRON_FECHA.exec(fecha);
  if (coincidencia) {
    const dia = {
      anio: Number(coincidencia[1]),
      mes: Number(coincidencia[2]) - 1,
      dia: Number(coincidencia[3]),
    };
    // Rechaza fechas inexistentes (2026-02-30, mes 13): al normalizarlas cambian.
    if (formatearFecha(normalizar(dia)) === fecha) {
      return dia;
    }
  }
  throw new ErrorDeDominio('FECHA_INVALIDA', `Fecha inválida: "${fecha}". Formato YYYY-MM-DD.`);
}

export function formatearFecha({ anio, mes, dia }: DiaCalendario): FechaLocal {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${String(anio).padStart(4, '0')}-${dos(mes + 1)}-${dos(dia)}` as FechaLocal;
}

function normalizar({ anio, mes, dia }: DiaCalendario): DiaCalendario {
  const fecha = new Date(Date.UTC(anio, mes, dia));
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth(), dia: fecha.getUTCDate() };
}

export function diaSiguiente(dia: DiaCalendario): DiaCalendario {
  return normalizar({ ...dia, dia: dia.dia + 1 });
}

export function diaDeLaSemana({ anio, mes, dia }: DiaCalendario): DiaSemana {
  return new Date(Date.UTC(anio, mes, dia)).getUTCDay() as DiaSemana;
}

export function compararDias(a: DiaCalendario, b: DiaCalendario): number {
  return a.anio - b.anio || a.mes - b.mes || a.dia - b.dia;
}

/** Día de calendario local en el que cae un instante. */
export function diaLocal(instante: Date, zonaHoraria: string): DiaCalendario {
  const local = new TZDate(instante.getTime(), zonaHoraria);
  return { anio: local.getFullYear(), mes: local.getMonth(), dia: local.getDate() };
}

/** Instante correspondiente a una hora local de un día dado. */
export function instanteLocal(dia: DiaCalendario, minutos: number, zonaHoraria: string): number {
  const horas = Math.floor(minutos / 60);
  return new TZDate(dia.anio, dia.mes, dia.dia, horas, minutos % 60, zonaHoraria).getTime();
}

/** Franjas de cobro vigentes para un día, considerando días especiales. */
export function franjasDelDia(regla: ReglaTarifaria, dia: DiaCalendario): readonly Franja[] {
  const fecha = formatearFecha(dia);
  const especial = regla.diasEspeciales?.find((d) => d.fecha === fecha);
  if (especial) {
    return especial.franjas;
  }
  const diaSemana = diaDeLaSemana(dia);
  return regla.horario.filter((franja) => franja.dias.includes(diaSemana));
}

/** Intervalos de cobro `[desde, hasta)` en milisegundos epoch para un día local. */
export function intervalosDeCobro(
  regla: ReglaTarifaria,
  dia: DiaCalendario,
): readonly (readonly [number, number])[] {
  return franjasDelDia(regla, dia).map(
    (franja) =>
      [
        instanteLocal(dia, minutosDesdeMedianoche(franja.desde), regla.zonaHoraria),
        instanteLocal(dia, minutosDesdeMedianoche(franja.hasta), regla.zonaHoraria),
      ] as const,
  );
}
