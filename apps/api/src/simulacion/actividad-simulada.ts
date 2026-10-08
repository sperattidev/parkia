import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { eq } from 'drizzle-orm';

import { Reloj } from '../comun/reloj.js';
import type { Entorno } from '../config/entorno.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { municipios } from '../db/esquema.js';
import { Simulador } from './simulador.js';

/** Ocupación que se sostiene durante la demostración. */
export const OCUPACION_DE_DEMO = 0.35;

/**
 * Con `PARKIA_SIMULACION=true` (nunca en producción), cada cinco minutos y
 * mientras se cobra, los conductores ficticios llegan, se van y algunos se
 * quedan sin saldo: la demo muestra una calle con movimiento.
 */
@Injectable()
export class ActividadSimulada {
  private readonly logger = new Logger(ActividadSimulada.name);
  private readonly simulador: Simulador | null;
  private enCurso = false;

  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    config: ConfigService<Entorno, true>,
    reloj: Reloj,
  ) {
    // En tests la simulación se invoca explícitamente, con el reloj controlado.
    const habilitada =
      config.get('PARKIA_SIMULACION', { infer: true }) &&
      config.get('NODE_ENV', { infer: true }) !== 'test';
    this.simulador = habilitada
      ? new Simulador(
          conexion,
          { PARKIA_ENTORNO: config.get('PARKIA_ENTORNO', { infer: true }) },
          () => reloj.ahora(),
        )
      : null;
  }

  @Cron('0 */5 * * * *', { name: 'actividad-simulada' })
  async ejecutar(): Promise<void> {
    if (!this.simulador || this.enCurso) return;
    this.enCurso = true;
    try {
      const activos = await this.conexion.db
        .select({ slug: municipios.slug })
        .from(municipios)
        .where(eq(municipios.activo, true));
      for (const { slug } of activos) {
        if (!(await this.simulador.enHorarioDeCobro(slug))) continue;
        const resumen = await this.simulador.ejecutar({
          municipio: slug,
          ocupacion: OCUPACION_DE_DEMO,
          retroactiva: false,
        });
        this.logger.log(resumen, 'Actividad simulada');
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Falló la actividad simulada');
    } finally {
      this.enCurso = false;
    }
  }
}
