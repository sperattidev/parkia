import { NextResponse, type NextRequest } from 'next/server';

/** Debe coincidir con `COOKIE_SESION` (el proxy no puede importar módulos `server-only`). */
const COOKIE_SESION = 'parkia_sesion';

/**
 * Las secciones personales exigen sesión: sin cookie, se redirige al ingreso y
 * se vuelve a la misma página después. La validez real del token la decide la API.
 */
export function proxy(solicitud: NextRequest): NextResponse {
  if (solicitud.cookies.has(COOKIE_SESION)) return NextResponse.next();
  const ingreso = new URL('/ingresar', solicitud.url);
  ingreso.searchParams.set('volver', solicitud.nextUrl.pathname);
  return NextResponse.redirect(ingreso);
}

export const config = {
  matcher: ['/:municipio/saldo', '/:municipio/vehiculos', '/:municipio/historial'],
};
