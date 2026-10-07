import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { validarEntorno } from '../config/entorno.js';
import { crearConexion } from './conexion.js';

// Igual desde src/db (tests) que desde dist/db (producción).
const CARPETA_MIGRACIONES = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Aplica las migraciones pendientes. Se ejecuta en cada deploy antes de levantar la API. */
export async function migrar(url: string): Promise<void> {
  const { db, pool } = crearConexion(url, 1);
  try {
    await migrate(db, { migrationsFolder: CARPETA_MIGRACIONES });
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  const { DATABASE_URL } = validarEntorno(process.env);
  await migrar(DATABASE_URL);
  console.info('Migraciones aplicadas.');
}
