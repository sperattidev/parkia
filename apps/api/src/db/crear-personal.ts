import { parseArgs } from 'node:util';

import { rolMunicipalSchema, type RolMunicipal } from '@parkia/contracts';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { hashearContrasena } from '../autenticacion/cripto.js';
import { validarEntorno } from '../config/entorno.js';
import { crearConexion, type BaseDeDatos } from './conexion.js';
import { membresias, municipios, usuarios } from './esquema.js';

export interface DatosDePersonal {
  readonly email: string;
  readonly municipio: string;
  readonly rol: RolMunicipal;
  readonly contrasena: string;
}

/** Crea (o actualiza) una cuenta de personal municipal con su rol. Idempotente. */
export async function crearPersonal(db: BaseDeDatos, datos: DatosDePersonal): Promise<void> {
  const hashContrasena = await hashearContrasena(datos.contrasena);
  await db.transaction(async (tx) => {
    const [municipio] = await tx
      .select({ id: municipios.id })
      .from(municipios)
      .where(eq(municipios.slug, datos.municipio));
    if (!municipio) throw new Error(`No existe el municipio "${datos.municipio}".`);

    const [usuario] = await tx
      .insert(usuarios)
      .values({ email: datos.email, hashContrasena })
      .onConflictDoUpdate({ target: usuarios.email, set: { hashContrasena } })
      .returning({ id: usuarios.id });
    if (!usuario) throw new Error('No se pudo crear el usuario.');

    await tx
      .insert(membresias)
      .values({ usuarioId: usuario.id, municipioId: municipio.id, rol: datos.rol })
      .onConflictDoNothing();
  });
}

const argumentosSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  municipio: z.string().min(1),
  rol: rolMunicipalSchema,
  contrasena: z.string().min(12, 'PARKIA_CONTRASENA debe tener al menos 12 caracteres'),
});

if (import.meta.main) {
  // pnpm reenvía el separador `--` literal: se descarta para aceptar ambas formas.
  const argumentos = process.argv.slice(2);
  const { values } = parseArgs({
    args: argumentos[0] === '--' ? argumentos.slice(1) : argumentos,
    options: {
      email: { type: 'string' },
      municipio: { type: 'string' },
      rol: { type: 'string' },
    },
  });
  // La contraseña llega por variable de entorno para que no quede en el historial de la terminal.
  const datos = argumentosSchema.parse({ ...values, contrasena: process.env.PARKIA_CONTRASENA });
  const { DATABASE_URL } = validarEntorno(process.env);
  const { db, pool } = crearConexion(DATABASE_URL, 1);
  try {
    await crearPersonal(db, datos);
    console.info(`Personal listo: ${datos.email} · ${datos.rol} en ${datos.municipio}.`);
  } finally {
    await pool.end();
  }
}
