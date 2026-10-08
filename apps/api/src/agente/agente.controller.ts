import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  jornadaSchema,
  padronSchema,
  radarSchema,
  slugMunicipioSchema,
  ubicacionSchema,
  type Jornada,
  type Padron,
  type Radar,
} from '@parkia/contracts';
import { z } from 'zod';

import { RequiereRol, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { AgenteService } from './agente.service.js';

const municipioParam = { schema: slugMunicipioSchema };

@ApiTags('Agente')
@ApiBearerAuth()
@RequiereRol('agente')
@Controller('municipios/:municipio/agente')
export class AgenteController {
  constructor(private readonly agente: AgenteService) {}

  @Get('cuadras/:cuadra/padron')
  @ApiOperation({
    summary: 'Vehículos declarados en la cuadra',
    description:
      'Por mano: estacionamientos en curso y vencidos de las últimas 2 horas. Un vehículo estacionado que no figura está en infracción.',
  })
  @ApiResponse({ status: 200, standardSchema: padronSchema })
  padron(
    @Param('municipio', municipioParam) municipio: string,
    @Param('cuadra', { schema: z.uuid() }) cuadra: string,
  ): Promise<Padron> {
    return this.agente.padron(municipio, cuadra);
  }

  @Get('radar')
  @ApiOperation({
    summary: 'Vencidos recientes y por vencer, los más cercanos primero',
    description: 'Con `lat` y `lng` ordena por distancia al agente.',
  })
  @ApiResponse({ status: 200, standardSchema: radarSchema })
  radar(
    @Param('municipio', municipioParam) municipio: string,
    @Query({ schema: ubicacionSchema.partial() }) consulta: { lat?: number; lng?: number },
  ): Promise<Radar> {
    const { lat, lng } = consulta;
    return this.agente.radar(
      municipio,
      lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    );
  }

  @Get('jornada')
  @ApiOperation({ summary: 'Resumen del día del agente y cobertura del equipo' })
  @ApiResponse({ status: 200, standardSchema: jornadaSchema })
  jornada(
    @Param('municipio', municipioParam) municipio: string,
    @UsuarioActual() agente: UsuarioAutenticado,
  ): Promise<Jornada> {
    return this.agente.jornada(agente.id, municipio);
  }
}
