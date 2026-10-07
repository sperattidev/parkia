import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as esquema from './esquema.js';

export type BaseDeDatos = NodePgDatabase<typeof esquema>;

export interface Conexion {
  readonly db: BaseDeDatos;
  readonly pool: pg.Pool;
}

export function crearConexion(url: string, maxConexiones = 10): Conexion {
  const pool = new pg.Pool({
    connectionString: url,
    max: maxConexiones,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'parkia-api',
  });
  return { pool, db: drizzle(pool, { schema: esquema, casing: 'snake_case' }) };
}
