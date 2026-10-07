import { ErrorDeDominio } from './errores.js';

declare const marcaCentavos: unique symbol;

/**
 * Importe en centavos de peso argentino. Siempre un entero no negativo:
 * nunca se opera con decimales de punto flotante sobre dinero.
 */
export type Centavos = number & { readonly [marcaCentavos]: true };

export function centavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new ErrorDeDominio(
      'DINERO_INVALIDO',
      `El importe debe ser un entero de centavos no negativo (recibido: ${valor}).`,
    );
  }
  return valor as Centavos;
}

/** Convierte pesos (admite hasta dos decimales) a centavos. */
export function pesos(valor: number): Centavos {
  return centavos(Math.round(valor * 100));
}

export function sumarCentavos(...importes: readonly Centavos[]): Centavos {
  return centavos(importes.reduce<number>((total, importe) => total + importe, 0));
}

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

/** Formato para mostrar al usuario, por ejemplo `$ 1.375,00`. */
export function formatearPesos(importe: Centavos): string {
  return formatoPesos.format(importe / 100);
}
