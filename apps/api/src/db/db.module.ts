import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Entorno } from '../config/entorno.js';
import { crearConexion, type Conexion } from './conexion.js';

export const CONEXION = Symbol('CONEXION');

@Global()
@Module({
  providers: [
    {
      provide: CONEXION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>): Conexion =>
        crearConexion(
          config.get('DATABASE_URL', { infer: true }),
          config.get('DATABASE_POOL_MAX', { infer: true }),
        ),
    },
  ],
  exports: [CONEXION],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(CONEXION) private readonly conexion: Conexion) {}

  async onApplicationShutdown(): Promise<void> {
    await this.conexion.pool.end();
  }
}
