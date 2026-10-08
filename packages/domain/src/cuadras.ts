import { ErrorDeDominio } from './errores.js';

/** Mano de la cuadra según la numeración de las casas. */
export type Lado = 'par' | 'impar';

export interface RangoDeAlturas {
  readonly alturaDesde: number;
  readonly alturaHasta: number;
}

/**
 * Altura aproximada de un punto dentro de una cuadra. `fraccion` es la posición
 * sobre la cuadra (0 al inicio de la numeración, 1 al final), como la calcula
 * PostGIS con `ST_LineLocatePoint`. La altura respeta la paridad de la mano.
 */
export function alturaEnCuadra(cuadra: RangoDeAlturas, fraccion: number, lado: Lado): number {
  const { alturaDesde, alturaHasta } = cuadra;
  if (!Number.isFinite(fraccion)) {
    throw new ErrorDeDominio('UBICACION_INVALIDA', 'La posición en la cuadra no es válida.');
  }
  const acotada = Math.min(1, Math.max(0, fraccion));
  let altura = Math.round(alturaDesde + acotada * (alturaHasta - alturaDesde));
  const esPar = altura % 2 === 0;
  if (esPar !== (lado === 'par')) altura += altura < alturaHasta ? 1 : -1;
  return altura;
}

/** Valida que una altura declarada esté dentro de la cuadra y en la mano correcta. */
export function validarAltura(cuadra: RangoDeAlturas, altura: number, lado: Lado): void {
  if (!Number.isSafeInteger(altura) || altura < cuadra.alturaDesde || altura > cuadra.alturaHasta) {
    throw new ErrorDeDominio(
      'ALTURA_FUERA_DE_CUADRA',
      `La altura debe estar entre ${cuadra.alturaDesde} y ${cuadra.alturaHasta}.`,
    );
  }
  if ((altura % 2 === 0) !== (lado === 'par')) {
    throw new ErrorDeDominio(
      'ALTURA_DE_OTRA_MANO',
      `La altura ${altura} corresponde a la mano ${lado === 'par' ? 'impar' : 'par'}.`,
    );
  }
}

/** Dirección legible: `Belgrano 1150`. */
export function direccion(calle: string, altura: number): string {
  return `${calle} ${altura}`;
}
