import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AutenticacionModule } from './autenticacion/autenticacion.module.js';
import { GuardiaDeAutenticacion } from './autenticacion/guardia.js';
import { BilleteraModule } from './billetera/billetera.module.js';
import { FiltroDeErrores } from './comun/filtro-de-errores.js';
import { validarEntorno, type Entorno } from './config/entorno.js';
import { CorreoModule } from './correo/correo.module.js';
import { DbModule } from './db/db.module.js';
import { MunicipiosModule } from './municipios/municipios.module.js';
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
    // Límite general por IP (en memoria: suficiente con una sola instancia de la API).
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
    DbModule,
    CorreoModule,
    MunicipiosModule,
    AutenticacionModule,
    SaludModule,
    ZonasModule,
    BilleteraModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: FiltroDeErrores },
    // El orden importa: primero el límite de tasa, después la autenticación.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: GuardiaDeAutenticacion },
  ],
})
export class AppModule {}
