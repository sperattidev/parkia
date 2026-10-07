import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configurarApp } from '../../src/configurar-app.js';
import { CONEXION } from '../../src/db/db.module.js';
import type { Conexion } from '../../src/db/conexion.js';

export interface AppDePrueba {
  readonly app: NestFastifyApplication;
  readonly conexion: Conexion;
}

/** Levanta la aplicación real (mismo módulo y misma configuración que producción). */
export async function crearAppDePrueba(): Promise<AppDePrueba> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configurarApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, conexion: app.get<Conexion>(CONEXION) };
}
