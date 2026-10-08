import 'server-only';

import type { RolMunicipal, Usuario } from '@parkia/contracts';
import type { Route } from 'next';
import { redirect } from 'next/navigation';

import { llamarApi, tokenDeSesion } from './api';

/** Roles que pueden usar la app de control. */
const ROLES_DE_CONTROL: readonly RolMunicipal[] = ['agente', 'admin'];

/** Usuario de la sesión actual, o `null` si no hay sesión válida. */
export async function usuarioActual(): Promise<Usuario | null> {
  const token = await tokenDeSesion();
  if (!token) return null;
  const respuesta = await llamarApi('/v1/auth/yo', { token });
  if (respuesta.status === 401) return null;
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status} en /v1/auth/yo.`);
  return (await respuesta.json()) as Usuario;
}

/**
 * Usuario del personal con la contraseña ya definitiva: sin sesión va al
 * ingreso; con una contraseña temporal, a cambiarla.
 */
export async function personalActual(): Promise<Usuario> {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/personal/ingresar');
  if (usuario.debeCambiarContrasena) redirect('/personal/contrasena');
  return usuario;
}

/** Municipios en los que el usuario puede controlar, en el orden en que los tiene. */
export function municipiosDeControl(usuario: Usuario): string[] {
  return usuario.membresias
    .filter((membresia) => ROLES_DE_CONTROL.includes(membresia.rol))
    .map((membresia) => membresia.municipio);
}

/** Municipios cuyo panel de gestión puede abrir. */
export function municipiosDeGestion(usuario: Usuario): string[] {
  return usuario.membresias
    .filter((membresia) => membresia.rol === 'admin')
    .map((membresia) => membresia.municipio);
}

/** Primer destino según el rol: equipo de Parkia, gestión municipal o control en la calle. */
export function destinoDelPersonal(usuario: Usuario): Route | null {
  if (usuario.debeCambiarContrasena) return '/personal/contrasena';
  if (usuario.administradorDeParkia) return '/plataforma';
  const [gestion] = municipiosDeGestion(usuario);
  if (gestion) return `/gestion/${gestion}` as Route;
  const [control] = municipiosDeControl(usuario);
  return control ? (`/agente/${control}` as Route) : null;
}
