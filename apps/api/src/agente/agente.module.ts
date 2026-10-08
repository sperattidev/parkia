import { Module } from '@nestjs/common';

import { ZonasModule } from '../zonas/zonas.module.js';
import { AgenteController } from './agente.controller.js';
import { AgenteService } from './agente.service.js';

@Module({
  imports: [ZonasModule],
  controllers: [AgenteController],
  providers: [AgenteService],
})
export class AgenteModule {}
