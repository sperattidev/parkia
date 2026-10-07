import { NextResponse, type NextRequest } from 'next/server';

import { llamarApi, tokenDeSesion } from '@/lib/servidor/api';
import { rechazoCsrf } from '@/lib/servidor/csrf';
import { borrarSesion } from '@/lib/servidor/sesion';

interface Contexto {
  params: Promise<{ ruta: string[] }>;
}

/**
 * Reenvía las llamadas del navegador a la API `/v1/...` con el token de la
 * cookie. La API sigue siendo la única que decide permisos.
 */
async function reenviar(solicitud: NextRequest, { params }: Contexto): Promise<NextResponse> {
  const rechazo = rechazoCsrf(solicitud);
  if (rechazo) return rechazo;

  const { ruta } = await params;
  const destino = `/v1/${ruta.map(encodeURIComponent).join('/')}${solicitud.nextUrl.search}`;
  const cuerpo = solicitud.method === 'GET' ? null : await solicitud.text();

  const respuesta = await llamarApi(destino, {
    metodo: solicitud.method,
    cuerpo: cuerpo === '' ? null : cuerpo,
    token: await tokenDeSesion(),
  });

  const salida =
    respuesta.status === 204
      ? new NextResponse(null, { status: 204 })
      : new NextResponse(await respuesta.text(), {
          status: respuesta.status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
  // Una sesión vencida o revocada en la API se limpia también en el navegador.
  if (respuesta.status === 401) borrarSesion(salida);
  return salida;
}

export { reenviar as DELETE, reenviar as GET, reenviar as POST };
