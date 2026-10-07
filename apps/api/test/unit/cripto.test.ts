import { describe, expect, it } from 'vitest';

import {
  HASH_SENUELO,
  generarCodigo,
  generarToken,
  hashearContrasena,
  huella,
  huellasIguales,
  verificarContrasena,
} from '../../src/autenticacion/cripto.js';

describe('cripto', () => {
  it('genera tokens de 256 bits únicos', () => {
    const tokens = new Set(Array.from({ length: 100 }, generarToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('genera códigos de 6 dígitos', () => {
    for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
  });

  it('la huella depende de la clave', () => {
    expect(huella('clave-a', 'valor')).not.toBe(huella('clave-b', 'valor'));
    expect(huellasIguales(huella('k', 'v'), huella('k', 'v'))).toBe(true);
    expect(huellasIguales(huella('k', 'v'), huella('k', 'w'))).toBe(false);
    expect(huellasIguales('abcd', 'abcdef')).toBe(false);
  });

  it('hashea y verifica contraseñas con sal aleatoria', async () => {
    const hash = await hashearContrasena('contraseña segura');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await hashearContrasena('contraseña segura')).not.toBe(hash);
    expect(await verificarContrasena('contraseña segura', hash)).toBe(true);
    expect(await verificarContrasena('contraseña insegura', hash)).toBe(false);
  });

  it('rechaza hashes mal formados y el señuelo nunca coincide', async () => {
    expect(await verificarContrasena('x', 'md5$abc')).toBe(false);
    expect(await verificarContrasena('', HASH_SENUELO)).toBe(false);
  });
});
