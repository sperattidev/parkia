import { inject } from 'vitest';

// Se ejecuta antes de importar cada archivo de test: la app debe leer la base
// efímera del contenedor, nunca la de desarrollo.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL = inject('databaseUrl');
process.env.AUTH_SECRET = 'clave-de-pruebas-de-integracion-0123456789';
process.env.CORREO_PROVEEDOR = 'consola';
