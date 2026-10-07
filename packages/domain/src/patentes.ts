import { ErrorDeDominio } from './errores.js';

declare const marcaPatente: unique symbol;

/** Patente normalizada: mayúsculas, sin espacios ni guiones. */
export type Patente = string & { readonly [marcaPatente]: true };

export type FormatoPatente = 'auto-1995' | 'auto-mercosur' | 'moto-1995' | 'moto-mercosur';

/**
 * Formatos vigentes en Argentina:
 * - Autos 1995–2016: `ABC123`.
 * - Autos Mercosur (desde 2016): `AB123CD`.
 * - Motos 1995–2016: `123ABC`.
 * - Motos Mercosur (desde 2016): `A123BCD`.
 */
const FORMATOS: readonly (readonly [FormatoPatente, RegExp])[] = [
  ['auto-1995', /^[A-Z]{3}\d{3}$/],
  ['auto-mercosur', /^[A-Z]{2}\d{3}[A-Z]{2}$/],
  ['moto-1995', /^\d{3}[A-Z]{3}$/],
  ['moto-mercosur', /^[A-Z]\d{3}[A-Z]{3}$/],
];

/** Detecta el formato de una patente ya normalizada, o `null` si no es válida. */
export function formatoDePatente(patente: string): FormatoPatente | null {
  return FORMATOS.find(([, patron]) => patron.test(patente))?.[0] ?? null;
}

/**
 * Normaliza lo que escribe un usuario o lee una cámara (`ab 123 cd`, `AB-123-CD`)
 * y valida que sea una patente argentina.
 */
export function normalizarPatente(entrada: string): Patente {
  const normalizada = entrada.toUpperCase().replace(/[\s\-.·]/g, '');
  if (formatoDePatente(normalizada) === null) {
    throw new ErrorDeDominio(
      'PATENTE_INVALIDA',
      `"${entrada}" no es una patente argentina válida (ej.: AB123CD o ABC123).`,
    );
  }
  return normalizada as Patente;
}

export function esPatenteValida(entrada: string): boolean {
  try {
    normalizarPatente(entrada);
    return true;
  } catch {
    return false;
  }
}
