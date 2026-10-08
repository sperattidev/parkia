import { Module } from '@nestjs/common';

import { ActividadSimulada } from './actividad-simulada.js';

@Module({ providers: [ActividadSimulada] })
export class SimulacionModule {}
