import { Global, Module } from '@nestjs/common';

import { MunicipiosController } from './municipios.controller.js';
import { MunicipiosService } from './municipios.service.js';

@Global()
@Module({
  controllers: [MunicipiosController],
  providers: [MunicipiosService],
  exports: [MunicipiosService],
})
export class MunicipiosModule {}
