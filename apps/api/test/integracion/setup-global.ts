import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

import { migrar } from '../../src/db/migrar.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let contenedor: StartedPostgreSqlContainer | undefined;

/** Un PostGIS efímero por corrida, con las mismas migraciones que producción. */
export async function setup(proyecto: TestProject): Promise<void> {
  contenedor = await new PostgreSqlContainer('postgis/postgis:17-3.5')
    .withLabels({ 'com.parkia.project': 'parkia' })
    .start();
  const url = contenedor.getConnectionUri();
  await migrar(url);
  proyecto.provide('databaseUrl', url);
}

export async function teardown(): Promise<void> {
  await contenedor?.stop();
}
