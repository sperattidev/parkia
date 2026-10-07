import 'server-only';

import { cookies, headers } from 'next/headers';

/** Cookie `httpOnly` con el token de sesión: el JavaScript del navegador nunca lo ve. */
export const COOKIE_SESION = 'parkia_sesion';

function urlDeLaApi(ruta: string): string {
  const base = process.env.PARKIA_API_URL;
  if (!base) throw new Error('Falta la variable de entorno PARKIA_API_URL.');
  return new URL(ruta, base).toString();
}

export async function tokenDeSesion(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_SESION)?.value;
}

/**
 * Llama a la API desde el servidor de Next, agregando el token de la cookie y
 * la IP real del visitante (para los límites de intentos de la API).
 */
export async function llamarApi(
  ruta: string,
  opciones: { metodo?: string; cuerpo?: string | null; token?: string | undefined } = {},
): Promise<Response> {
  const entrantes = await headers();
  const salientes = new Headers({ accept: 'application/json' });
  if (opciones.cuerpo) salientes.set('content-type', 'application/json');
  if (opciones.token) salientes.set('authorization', `Bearer ${opciones.token}`);
  for (const nombre of ['cf-connecting-ip', 'user-agent']) {
    const valor = entrantes.get(nombre);
    if (valor) salientes.set(nombre, valor);
  }

  return fetch(urlDeLaApi(ruta), {
    method: opciones.metodo ?? 'GET',
    headers: salientes,
    body: opciones.cuerpo ?? null,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
}

/** GET a la API que devuelve JSON, o `null` si responde 404. */
export async function obtenerDeLaApi<T>(ruta: string, token?: string): Promise<T | null> {
  const respuesta = await llamarApi(ruta, { token });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status} en ${ruta}.`);
  return (await respuesta.json()) as T;
}
