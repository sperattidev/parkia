import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

import { ipDelCliente } from './ip-cliente.js';

/** Límite de tasa por IP real del cliente (ver `ipDelCliente`). */
@Injectable()
export class GuardiaDeLimites extends ThrottlerGuard {
  protected override getTracker(solicitud: Record<string, unknown>): Promise<string> {
    return Promise.resolve(ipDelCliente(solicitud as unknown as FastifyRequest));
  }
}
