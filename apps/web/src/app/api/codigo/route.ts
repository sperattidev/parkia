import { NextResponse, type NextRequest } from 'next/server';

import { llamarApi } from '@/lib/servidor/api';
import { rechazoCsrf } from '@/lib/servidor/csrf';

/** Pide a la API que envíe un código de acceso por email. */
export async function POST(solicitud: NextRequest): Promise<NextResponse> {
  const rechazo = rechazoCsrf(solicitud);
  if (rechazo) return rechazo;

  const respuesta = await llamarApi('/v1/auth/codigos', {
    metodo: 'POST',
    cuerpo: await solicitud.text(),
  });
  if (respuesta.status === 202) return new NextResponse(null, { status: 202 });
  return NextResponse.json(await respuesta.json(), { status: respuesta.status });
}
