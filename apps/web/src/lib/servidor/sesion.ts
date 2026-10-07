import 'server-only';

import type { NextResponse } from 'next/server';

import { COOKIE_SESION } from './api';

export function guardarSesion(respuesta: NextResponse, token: string, expiraEn: Date): void {
  respuesta.cookies.set({
    name: COOKIE_SESION,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiraEn,
  });
}

export function borrarSesion(respuesta: NextResponse): void {
  respuesta.cookies.delete(COOKIE_SESION);
}
