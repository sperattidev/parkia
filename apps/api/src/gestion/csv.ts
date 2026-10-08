/**
 * CSV para abrir en Excel con configuración regional argentina: separador `;`,
 * coma decimal y marca BOM para que reconozca UTF-8 (acentos y eñes).
 */
const BOM = '﻿';

export type Celda = string | number | null;

/**
 * Escapa una celda. Las que empiezan con `=`, `+`, `-` o `@` se prefijan con
 * un apóstrofo para que Excel no las ejecute como fórmula (inyección CSV).
 */
function celda(valor: Celda): string {
  if (valor === null) return '';
  let texto = String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[;"\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function generarCsv(encabezados: readonly string[], filas: readonly Celda[][]): string {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(';'));
  return BOM + lineas.join('\r\n') + '\r\n';
}

/** Centavos como pesos con coma decimal, sin separador de miles: `1375,50`. */
export function pesosParaCsv(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/** Fecha y hora local `dd/mm/aaaa hh:mm`. */
export function fechaHoraParaCsv(instante: Date | null, zonaHoraria: string): string | null {
  if (!instante) return null;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: zonaHoraria,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(instante)
    .replace(',', '');
}
