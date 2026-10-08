import { describe, expect, it } from 'vitest';

import { alturaEnCuadra, direccion, validarAltura } from '../src/index.js';

const cuadra = { alturaDesde: 1100, alturaHasta: 1199 };

describe('alturaEnCuadra', () => {
  it('interpola la altura y respeta la paridad de la mano', () => {
    expect(alturaEnCuadra(cuadra, 0.5, 'par')).toBe(1150);
    expect(alturaEnCuadra(cuadra, 0.5, 'impar')).toBe(1151);
  });

  it('se mantiene dentro de la cuadra en los extremos', () => {
    expect(alturaEnCuadra(cuadra, 0, 'par')).toBe(1100);
    expect(alturaEnCuadra(cuadra, 0, 'impar')).toBe(1101);
    expect(alturaEnCuadra(cuadra, 1, 'impar')).toBe(1199);
    expect(alturaEnCuadra(cuadra, 1, 'par')).toBe(1198);
    expect(alturaEnCuadra(cuadra, 1.4, 'par')).toBe(1198);
    expect(alturaEnCuadra(cuadra, -0.2, 'impar')).toBe(1101);
  });

  it('rechaza posiciones inválidas', () => {
    expect(() => alturaEnCuadra(cuadra, Number.NaN, 'par')).toThrow(
      expect.objectContaining({ codigo: 'UBICACION_INVALIDA' }),
    );
  });
});

describe('validarAltura', () => {
  it('acepta alturas de la cuadra en la mano correcta', () => {
    expect(() => {
      validarAltura(cuadra, 1150, 'par');
    }).not.toThrow();
  });

  it('rechaza alturas fuera de la cuadra o de la otra mano', () => {
    expect(() => {
      validarAltura(cuadra, 1250, 'par');
    }).toThrow(expect.objectContaining({ codigo: 'ALTURA_FUERA_DE_CUADRA' }));
    expect(() => {
      validarAltura(cuadra, 1151, 'par');
    }).toThrow(expect.objectContaining({ codigo: 'ALTURA_DE_OTRA_MANO' }));
    expect(() => {
      validarAltura(cuadra, 1150.5, 'par');
    }).toThrow(expect.objectContaining({ codigo: 'ALTURA_FUERA_DE_CUADRA' }));
  });
});

describe('direccion', () => {
  it('arma la dirección legible', () => {
    expect(direccion('Belgrano', 1150)).toBe('Belgrano 1150');
  });
});
