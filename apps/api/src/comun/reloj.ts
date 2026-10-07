import { Global, Module } from '@nestjs/common';

/**
 * Fuente de la hora actual. Las reglas de negocio dependen de la hora (horario
 * de cobro, vencimientos): inyectarla permite probarlas de forma determinista.
 */
export abstract class Reloj {
  abstract ahora(): Date;
}

export class RelojDelSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}

@Global()
@Module({
  providers: [{ provide: Reloj, useClass: RelojDelSistema }],
  exports: [Reloj],
})
export class RelojModule {}
