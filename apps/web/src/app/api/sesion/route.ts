import { NextResponse, type NextRequest } from 'next/server';

import { llamarApi, tokenDeSesion } from '@/lib/servidor/api';
import { rechazoCsrf } from '@/lib/servidor/csrf';
import { iniciarSesion } from '@/lib/servidor/ingreso';
import { borrarSesion } from '@/lib/servidor/sesion';

/** Canjea el código por una sesión y la guarda en la cookie `httpOnly`. */
export function POST(solicitud: NextRequest): Promise<NextResponse> {
  return iniciarSesion(solicitud, '/v1/auth/sesiones');
}

/** Cierra la sesión en la API y borra la cookie. */
export async function DELETE(solicitud: NextRequest): Promise<NextResponse> {
  const rechazo = rechazoCsrf(solicitud);
  if (rechazo) return rechazo;

  const token = await tokenDeSesion();
  if (token) await llamarApi('/v1/auth/sesiones/actual', { metodo: 'DELETE', token });
  const salida = new NextResponse(null, { status: 204 });
  borrarSesion(salida);
  return salida;
}
