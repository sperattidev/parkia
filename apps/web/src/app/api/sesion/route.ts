import type { Sesion } from '@parkia/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { llamarApi, tokenDeSesion } from '@/lib/servidor/api';
import { rechazoCsrf } from '@/lib/servidor/csrf';
import { borrarSesion, guardarSesion } from '@/lib/servidor/sesion';

/** Canjea el código por una sesión y la guarda en la cookie `httpOnly`. */
export async function POST(solicitud: NextRequest): Promise<NextResponse> {
  const rechazo = rechazoCsrf(solicitud);
  if (rechazo) return rechazo;

  const respuesta = await llamarApi('/v1/auth/sesiones', {
    metodo: 'POST',
    cuerpo: await solicitud.text(),
  });
  const cuerpo = (await respuesta.json()) as unknown;
  if (!respuesta.ok) return NextResponse.json(cuerpo, { status: respuesta.status });

  const { token, expiraEn, usuario } = cuerpo as Sesion;
  const salida = NextResponse.json(usuario, { status: 201 });
  guardarSesion(salida, token, new Date(expiraEn));
  return salida;
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
