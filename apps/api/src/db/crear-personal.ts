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
  readonly contrasena: string;
  /** Municipio y rol de la membresía; se omiten para un administrador de Parkia sin municipio. */
  readonly municipio?: string | undefined;
  readonly rol?: RolMunicipal | undefined;
  readonly administradorDeParkia?: boolean | undefined;
}

/**
 * Crea (o actualiza) una cuenta de personal con su rol. Idempotente: si la
 * cuenta existe, se le asigna la contraseña y se reactiva la membresía.
 * Es la vía de alta desde la terminal (el primer administrador de Parkia y
 * soporte); desde los paneles, las altas pasan por `PersonalService`.
 */
export async function crearPersonal(db: BaseDeDatos, datos: DatosDePersonal): Promise<void> {
  const hashContrasena = await hashearContrasena(datos.contrasena);
  await db.transaction(async (tx) => {
    const [usuario] = await tx
      .insert(usuarios)
      .values({
        email: datos.email,
        hashContrasena,
        administradorDeParkia: datos.administradorDeParkia ?? false,
      })
      .onConflictDoUpdate({
        target: usuarios.email,
        set: {
          hashContrasena,
          debeCambiarContrasena: false,
          ...(datos.administradorDeParkia && { administradorDeParkia: true }),
        },
      })
      .returning({ id: usuarios.id });
    if (!usuario) throw new Error('No se pudo crear el usuario.');

    if (!datos.municipio || !datos.rol) return;
    const [municipio] = await tx
      .select({ id: municipios.id })
      .from(municipios)
      .where(eq(municipios.slug, datos.municipio));
    if (!municipio) throw new Error(`No existe el municipio "${datos.municipio}".`);

    await tx
      .insert(membresias)
      .values({ usuarioId: usuario.id, municipioId: municipio.id, rol: datos.rol })
      .onConflictDoUpdate({
        target: [membresias.usuarioId, membresias.municipioId, membresias.rol],
        set: { activa: true },
      });
  });
}

const argumentosSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    municipio: z.string().min(1).optional(),
    rol: rolMunicipalSchema.optional(),
    parkia: z.boolean().optional(),
    contrasena: z.string().min(12, 'PARKIA_CONTRASENA debe tener al menos 12 caracteres'),
  })
  .refine((datos) => datos.parkia === true || (datos.municipio && datos.rol), {
    message: 'Indicá --municipio y --rol, o --parkia para un administrador de Parkia.',
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
      parkia: { type: 'boolean' },
    },
  });
  // La contraseña llega por variable de entorno para que no quede en el historial de la terminal.
  const { parkia, ...datos } = argumentosSchema.parse({
    ...values,
    contrasena: process.env.PARKIA_CONTRASENA,
  });
  const { DATABASE_URL } = validarEntorno(process.env);
  const { db, pool } = crearConexion(DATABASE_URL, 1);
  try {
    await crearPersonal(db, { ...datos, administradorDeParkia: parkia });
    const destino = datos.municipio ? ` · ${datos.rol ?? ''} en ${datos.municipio}` : '';
    console.info(
      `Personal listo: ${datos.email}${parkia ? ' · administrador de Parkia' : ''}${destino}.`,
    );
  } finally {
    await pool.end();
  }
}
