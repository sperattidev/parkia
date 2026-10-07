/** Error de la API con su código estable (ver `CuerpoDeError` en la API). */
export class ErrorDeParkia extends Error {
  override readonly name = 'ErrorDeParkia';

  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles: readonly { campo: string; mensaje: string }[] = [],
  ) {
    super(mensaje);
  }
}

interface CuerpoDeError {
  codigo?: string;
  mensaje?: string;
  detalles?: { campo: string; mensaje: string }[];
}

const MENSAJE_SIN_CONEXION = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';

/** Llamada a un endpoint propio de la web (mismo origen, con la cookie de sesión). */
export async function pedir<T>(
  url: string,
  opciones: { metodo?: 'GET' | 'POST' | 'DELETE'; cuerpo?: unknown } = {},
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: opciones.metodo ?? 'GET',
      headers: {
        accept: 'application/json',
        'x-parkia': '1',
        ...(opciones.cuerpo !== undefined && { 'content-type': 'application/json' }),
      },
      ...(opciones.cuerpo !== undefined && { body: JSON.stringify(opciones.cuerpo) }),
      cache: 'no-store',
    });
  } catch {
    throw new ErrorDeParkia(0, 'SIN_CONEXION', MENSAJE_SIN_CONEXION);
  }

  if (respuesta.status === 202 || respuesta.status === 204) return undefined as T;
  const cuerpo = (await respuesta.json().catch(() => null)) as unknown;
  if (!respuesta.ok) {
    const error = (cuerpo ?? {}) as CuerpoDeError;
    throw new ErrorDeParkia(
      respuesta.status,
      error.codigo ?? 'ERROR',
      error.mensaje ?? 'Ocurrió un error inesperado.',
      error.detalles,
    );
  }
  return cuerpo as T;
}

/** Atajo para la API de Parkia vía el proxy autenticado de la web. */
export const api = <T>(ruta: string, opciones?: Parameters<typeof pedir>[1]) =>
  pedir<T>(`/api/parkia/${ruta}`, opciones);

/** Mensaje para mostrar al usuario, priorizando el detalle de validación. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeParkia) return error.detalles[0]?.mensaje ?? error.message;
  return 'Ocurrió un error inesperado.';
}
