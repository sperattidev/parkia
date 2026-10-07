import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

/** Encabezado que solo puede enviar el JavaScript de la propia web. */
export const ENCABEZADO_CSRF = 'x-parkia';

/**
 * Las operaciones que modifican datos exigen el encabezado propio: un sitio
 * ajeno no puede agregarlo a un formulario ni (sin CORS) a un fetch, así que
 * no puede usar la cookie de sesión del visitante.
 */
export function rechazoCsrf(solicitud: NextRequest): NextResponse | null {
  const segura = solicitud.method === 'GET' || solicitud.method === 'HEAD';
  if (segura || solicitud.headers.get(ENCABEZADO_CSRF) === '1') return null;
  return NextResponse.json(
    { statusCode: 403, codigo: 'CSRF', mensaje: 'Solicitud rechazada.' },
    { status: 403 },
  );
}
