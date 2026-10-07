import { Module } from '@nestjs/common';

import { BilleteraModule } from '../billetera/billetera.module.js';
import { ZonasModule } from '../zonas/zonas.module.js';
import { CierreAutomatico } from './cierre-automatico.js';
import { ControlService } from './control.service.js';
import { ControlController, EstacionamientosController } from './estacionamientos.controller.js';
import { EstacionamientosService } from './estacionamientos.service.js';

@Module({
  imports: [BilleteraModule, ZonasModule],
  controllers: [EstacionamientosController, ControlController],
  providers: [EstacionamientosService, ControlService, CierreAutomatico],
})
export class EstacionamientosModule {}
