import helmet from '@fastify/helmet';
import { HttpStatus, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { z } from 'zod';

import { ErrorDeApi } from './comun/errores.js';
import type { Entorno } from './config/entorno.js';

interface Problema {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

function campo(problema: Problema): string {
  return (problema.path ?? [])
    .map((segmento) => String(typeof segmento === 'object' ? segmento.key : segmento))
    .join('.');
}

/**
 * Configuración compartida por `main.ts` y los tests de integración, para que
 * los tests ejerciten exactamente la misma aplicación que corre en producción.
 */
export async function configurarApp(app: NestFastifyApplication): Promise<void> {
  const config = app.get<ConfigService<Entorno, true>>(ConfigService);

  // Mensajes de validación en español para los usuarios finales.
  z.config(z.locales.es());

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.setGlobalPrefix('v1', { exclude: ['salud'] });

  await app.register(helmet, {
    // Swagger UI necesita estilos y scripts en línea.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
      },
    },
  });
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }), credentials: true });

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (problemas: readonly Problema[]) =>
        new ErrorDeApi(
          HttpStatus.BAD_REQUEST,
          'VALIDACION',
          'Los datos enviados no son válidos.',
          problemas.map((problema) => ({ campo: campo(problema), mensaje: problema.message })),
        ),
    }),
  );

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Parkia API')
      .setDescription('API del sistema de estacionamiento medido Parkia')
      .setVersion('0.1.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, documento, { jsonDocumentUrl: 'docs/openapi.json' });
}
