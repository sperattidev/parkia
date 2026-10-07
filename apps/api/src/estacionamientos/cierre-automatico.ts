import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import type { Entorno } from '../config/entorno.js';
import { EstacionamientosService } from './estacionamientos.service.js';

/** Cada minuto cierra (y cobra) los estacionamientos cuyo saldo se agotó. */
@Injectable()
export class CierreAutomatico {
  private readonly logger = new Logger(CierreAutomatico.name);
  private enCurso = false;

  constructor(
    private readonly estacionamientos: EstacionamientosService,
    private readonly config: ConfigService<Entorno, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'cierre-de-vencidos' })
  async ejecutar(): Promise<void> {
    // En tests el cierre se invoca explícitamente, con el reloj controlado.
    if (this.enCurso || this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.enCurso = true;
    try {
      const cerrados = await this.estacionamientos.cerrarVencidos();
      if (cerrados > 0) this.logger.log({ cerrados }, 'Estacionamientos vencidos cerrados');
    } catch (error) {
      this.logger.error({ err: error }, 'Falló el cierre de estacionamientos vencidos');
    } finally {
      this.enCurso = false;
    }
  }
}
