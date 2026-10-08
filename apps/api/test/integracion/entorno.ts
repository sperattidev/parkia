import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { inject } from 'vitest';

// Se ejecuta antes de importar cada archivo de test: la app debe leer la base
// efímera del contenedor, nunca la de desarrollo.
process.env.NODE_ENV = 'test';
// `LOG_LEVEL_PRUEBAS=error` muestra los errores de la app al depurar un test.
process.env.LOG_LEVEL = process.env.LOG_LEVEL_PRUEBAS ?? 'silent';
process.env.AUTH_SECRET = 'clave-de-pruebas-de-integracion-0123456789';
process.env.CORREO_PROVEEDOR = 'consola';

// Cada archivo trabaja sobre su propia base, clonada de la plantilla migrada:
// los datos de un archivo no alteran los resultados de otro.
const plantilla = new URL(inject('databaseUrl'));
const propia = new URL(plantilla);
propia.pathname = `/prueba_${randomUUID().replaceAll('-', '')}`;

const administracion = new URL(plantilla);
administracion.pathname = '/postgres';
const cliente = new pg.Client({ connectionString: administracion.toString() });
await cliente.connect();
try {
  await cliente.query(
    `CREATE DATABASE "${propia.pathname.slice(1)}" TEMPLATE "${plantilla.pathname.slice(1)}"`,
  );
} finally {
  await cliente.end();
}

process.env.DATABASE_URL = propia.toString();
