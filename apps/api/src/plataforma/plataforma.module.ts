import { Module } from '@nestjs/common';

import { GestionModule } from '../gestion/gestion.module.js';
import { PlataformaController } from './plataforma.controller.js';
import { PlataformaService } from './plataforma.service.js';

@Module({
  imports: [GestionModule],
  controllers: [PlataformaController],
  providers: [PlataformaService],
})
export class PlataformaModule {}
