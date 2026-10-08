import 'server-only';

import type { RolMunicipal, Usuario } from '@parkia/contracts';

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

/** Municipios en los que el usuario puede controlar, en el orden en que los tiene. */
export function municipiosDeControl(usuario: Usuario): string[] {
  return usuario.membresias
    .filter((membresia) => ROLES_DE_CONTROL.includes(membresia.rol))
    .map((membresia) => membresia.municipio);
}
