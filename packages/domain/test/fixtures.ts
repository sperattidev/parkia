import { pesos, type ReglaTarifaria } from '../src/index.js';

/** Instante a partir de una hora local de Argentina (UTC−3, sin horario de verano). */
export function ar(fechaHora: string): Date {
  return new Date(`${fechaHora}-03:00`);
}

/**
 * Regla de ejemplo con valores verosímiles para el microcentro de una ciudad
 * mediana. Calendario de referencia: el lunes 5/10/2026, el sábado 10/10/2026,
 * el domingo 11/10/2026 y el feriado del lunes 12/10/2026.
 *
 * - Lunes a viernes 08:00–20:00, sábados 08:00–13:00.
 * - Fracción de 15 min, mínimo 30 min, tolerancia 5 min.
 * - Progresiva: 1.ª hora $1.000, 2.ª hora $1.500, desde la 3.ª $1.650.
 * - Tope de $10.000 por jornada.
 */
export const reglaMicrocentro: ReglaTarifaria = {
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  horario: [
    { dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '20:00' },
    { dias: [6], desde: '08:00', hasta: '13:00' },
  ],
  diasEspeciales: [{ fecha: '2026-10-12', franjas: [], motivo: 'Feriado nacional' }],
  fraccionMinutos: 15,
  minimoMinutos: 30,
  toleranciaMinutos: 5,
  tramos: [
    { desdeMinuto: 0, precioHora: pesos(1000) },
    { desdeMinuto: 60, precioHora: pesos(1500) },
    { desdeMinuto: 120, precioHora: pesos(1650) },
  ],
  topePorJornada: pesos(10_000),
};
