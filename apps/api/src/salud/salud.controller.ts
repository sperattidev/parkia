import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';

import { Publico } from '../autenticacion/decoradores.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';

@Publico()
@SkipThrottle()
@ApiTags('Salud')
@Controller('salud')
export class SaludController {
  constructor(
    private readonly salud: HealthCheckService,
    private readonly indicador: HealthIndicatorService,
    @Inject(CONEXION) private readonly conexion: Conexion,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Estado de la API y de la base de datos' })
  verificar(): Promise<HealthCheckResult> {
    return this.salud.check([() => this.baseDeDatos()]);
  }

  private async baseDeDatos() {
    const indicador = this.indicador.check('baseDeDatos');
    try {
      await this.conexion.db.execute(sql`select 1`);
      return indicador.up();
    } catch (error) {
      return indicador.down({ mensaje: error instanceof Error ? error.message : 'sin detalle' });
    }
  }
}
