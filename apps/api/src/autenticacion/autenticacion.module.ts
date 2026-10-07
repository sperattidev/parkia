import { Module } from '@nestjs/common';

import { AutenticacionController } from './autenticacion.controller.js';
import { AutenticacionService } from './autenticacion.service.js';
import { GuardiaDeAutenticacion } from './guardia.js';

@Module({
  controllers: [AutenticacionController],
  providers: [AutenticacionService, GuardiaDeAutenticacion],
  exports: [AutenticacionService, GuardiaDeAutenticacion],
})
export class AutenticacionModule {}
