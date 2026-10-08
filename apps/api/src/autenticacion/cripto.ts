import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/** Token de sesión opaco: 256 bits aleatorios. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Sin letras ni números que se confundan al dictarlos o copiarlos (0/O, 1/l/I). */
const ALFABETO_TEMPORAL = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Contraseña temporal para el alta o el restablecimiento de personal:
 * 16 caracteres (~79 bits) en grupos de 4, fácil de transmitir y que se exige
 * cambiar en el primer ingreso.
 */
export function generarContrasenaTemporal(): string {
  const caracteres = Array.from(
    { length: 16 },
    () => ALFABETO_TEMPORAL[randomInt(0, ALFABETO_TEMPORAL.length)] ?? 'a',
  );
  return [0, 4, 8, 12].map((i) => caracteres.slice(i, i + 4).join('')).join('-');
}

/** Código de acceso de 6 dígitos. */
export function generarCodigo(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Huella HMAC-SHA256 con la clave del servidor. Sin la clave, una copia de la
 * base no sirve para probar códigos ni tokens por fuerza bruta.
 */
export function huella(clave: string, valor: string): string {
  return createHmac('sha256', clave).update(valor).digest('hex');
}

export function huellasIguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

// Parámetros de scrypt recomendados por OWASP (N=2^15, r=8, p=1).
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const LARGO_CLAVE = 64;

function derivar(contrasena: string, sal: Buffer, opciones: ScryptOptions): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(contrasena.normalize('NFKC'), sal, LARGO_CLAVE, opciones, (error, clave) => {
      if (error) rechazar(error);
      else resolver(clave);
    });
  });
}

/** Formato: `scrypt$N$r$p$sal$hash` (base64url), autodescriptivo para poder migrar parámetros. */
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const clave = await derivar(contrasena, sal, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    sal.toString('base64url'),
    clave.toString('base64url'),
  ].join('$');
}

export async function verificarContrasena(
  contrasena: string,
  almacenado: string,
): Promise<boolean> {
  const [algoritmo, n, r, p, sal, clave] = almacenado.split('$');
  if (algoritmo !== 'scrypt' || !n || !r || !p || !sal || !clave) return false;
  const esperada = Buffer.from(clave, 'base64url');
  const obtenida = await derivar(contrasena, Buffer.from(sal, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return obtenida.length === esperada.length && timingSafeEqual(obtenida, esperada);
}

/** Hash válido de una contraseña imposible, para igualar tiempos cuando el usuario no existe. */
export const HASH_SENUELO = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);
