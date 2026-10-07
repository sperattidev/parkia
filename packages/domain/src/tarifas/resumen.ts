import { minutosDesdeMedianoche } from './calendario.js';
import type { DiaSemana, FranjaSemanal, HoraLocal } from './tipos.js';

/** Semana en el orden habitual en Argentina: de lunes a domingo. */
const SEMANA: readonly DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];
const NOMBRES: Readonly<Record<DiaSemana, string>> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

/** `08:00` → `8`, `08:30` → `8:30`. */
function horaBreve(hora: HoraLocal): string {
  const minutos = minutosDesdeMedianoche(hora);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, '0')}`;
}

function franjasDe(horario: readonly FranjaSemanal[], dia: DiaSemana): string {
  return horario
    .filter((franja) => franja.dias.includes(dia))
    .sort((a, b) => minutosDesdeMedianoche(a.desde) - minutosDesdeMedianoche(b.desde))
    .map((franja) => `${horaBreve(franja.desde)} a ${horaBreve(franja.hasta)}`)
    .join(' y ');
}

function nombreDeDias(dias: readonly DiaSemana[]): string {
  const primero = dias[0];
  const ultimo = dias.at(-1);
  if (primero === undefined || ultimo === undefined) return '';
  if (dias.length === 1) return NOMBRES[primero];
  if (dias.length === 2) return `${NOMBRES[primero]} y ${NOMBRES[ultimo]}`;
  return `${NOMBRES[primero]} a ${NOMBRES[ultimo]}`;
}

/**
 * Horario de cobro legible, agrupando días consecutivos con las mismas franjas:
 * `Lun a Vie 8 a 20 · Sáb 8 a 13`. Los días sin cobro no se mencionan.
 */
export function resumirHorario(horario: readonly FranjaSemanal[]): string {
  const grupos: { dias: DiaSemana[]; franjas: string }[] = [];
  for (const dia of SEMANA) {
    const franjas = franjasDe(horario, dia);
    const anterior = grupos.at(-1);
    if (anterior?.franjas === franjas) anterior.dias.push(dia);
    else grupos.push({ dias: [dia], franjas });
  }
  return grupos
    .filter((grupo) => grupo.franjas !== '')
    .map((grupo) => `${nombreDeDias(grupo.dias)} ${grupo.franjas}`)
    .join(' · ');
}
