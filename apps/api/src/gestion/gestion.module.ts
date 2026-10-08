import { Module } from '@nestjs/common';

import { ZonasModule } from '../zonas/zonas.module.js';
import { ConfiguracionService } from './configuracion.service.js';
import { GestionController } from './gestion.controller.js';
import { ListadosService } from './listados.service.js';
import { PersonalService } from './personal.service.js';
import { ResumenService } from './resumen.service.js';

@Module({
  imports: [ZonasModule],
  controllers: [GestionController],
  providers: [ResumenService, ListadosService, ConfiguracionService, PersonalService],
  exports: [PersonalService],
})
export class GestionModule {}
