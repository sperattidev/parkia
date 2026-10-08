import 'server-only';

import type { Sesion } from '@parkia/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { llamarApi } from './api';
import { rechazoCsrf } from './csrf';
import { guardarSesion } from './sesion';

/**
 * Reenvía las credenciales a la API y, si son válidas, guarda el token en la
 * cookie `httpOnly`. El navegador solo recibe los datos del usuario.
 */
export async function iniciarSesion(
  solicitud: NextRequest,
  rutaApi: string,
): Promise<NextResponse> {
  const rechazo = rechazoCsrf(solicitud);
  if (rechazo) return rechazo;

  const respuesta = await llamarApi(rutaApi, { metodo: 'POST', cuerpo: await solicitud.text() });
  const cuerpo = (await respuesta.json()) as unknown;
  if (!respuesta.ok) return NextResponse.json(cuerpo, { status: respuesta.status });

  const { token, expiraEn, usuario } = cuerpo as Sesion;
  const salida = NextResponse.json(usuario, { status: 201 });
  guardarSesion(salida, token, new Date(expiraEn));
  return salida;
}
