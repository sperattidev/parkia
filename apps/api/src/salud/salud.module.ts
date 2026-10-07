import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { SaludController } from './salud.controller.js';

@Module({
  imports: [TerminusModule],
  controllers: [SaludController],
})
export class SaludModule {}
