import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { FiltroDeErrores } from './comun/filtro-de-errores.js';
import { validarEntorno, type Entorno } from './config/entorno.js';
import { DbModule } from './db/db.module.js';
import { SaludModule } from './salud/salud.module.js';
import { ZonasModule } from './zonas/zonas.module.js';

@Module({
  imports: [
    // Las variables llegan por el entorno del proceso (Docker en producción,
    // `--env-file` en desarrollo). Nunca se lee un .env implícito.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true,
      validate: validarEntorno,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          // Con Fastify, `url` es relativa al montaje del middleware; `originalUrl` es la real.
          autoLogging: {
            ignore: (req) =>
              ((req as { originalUrl?: string }).originalUrl ?? req.url ?? '').startsWith('/salud'),
          },
          // Solo lo necesario para auditar: sin headers (evita filtrar tokens y reduce volumen).
          serializers: {
            req: ({ id, method, url }: { id: unknown; method: string; url: string }) => ({
              id,
              method,
              url,
            }),
            res: ({ statusCode }: { statusCode: number }) => ({ statusCode }),
          },
          ...(config.get('NODE_ENV', { infer: true }) === 'development' && {
            transport: { target: 'pino-pretty', options: { singleLine: true } },
          }),
        },
      }),
    }),
    DbModule,
    SaludModule,
    ZonasModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: FiltroDeErrores }],
})
export class AppModule {}
