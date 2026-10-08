import type { NextRequest, NextResponse } from 'next/server';

import { iniciarSesion } from '@/lib/servidor/ingreso';

/** Ingreso del personal municipal (agentes y administradores) con contraseña. */
export function POST(solicitud: NextRequest): Promise<NextResponse> {
  return iniciarSesion(solicitud, '/v1/auth/sesiones/contrasena');
}
