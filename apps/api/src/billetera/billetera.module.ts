import { Module } from '@nestjs/common';

import { BilleteraController } from './billetera.controller.js';
import { BilleteraService } from './billetera.service.js';
import { VehiculosController } from './vehiculos.controller.js';

@Module({
  controllers: [BilleteraController, VehiculosController],
  providers: [BilleteraService],
  exports: [BilleteraService],
})
export class BilleteraModule {}
