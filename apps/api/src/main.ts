import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';
import type { Entorno } from './config/entorno.js';
import { configurarApp } from './configurar-app.js';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  // Detrás de Cloudflare Tunnel: confiar en X-Forwarded-* para la IP real del cliente.
  new FastifyAdapter({ trustProxy: true, bodyLimit: 1_048_576 }),
  { bufferLogs: true },
);
await configurarApp(app);

const config = app.get<ConfigService<Entorno, true>>(ConfigService);
await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
