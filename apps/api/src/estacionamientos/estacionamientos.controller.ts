import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  controlSchema,
  estacionamientoSchema,
  inicioDeEstacionamientoSchema,
  slugMunicipioSchema,
  solicitudDeControlSchema,
  type Control,
  type Estacionamiento,
} from '@parkia/contracts';
import { z } from 'zod';

import { RequiereRol, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { ControlService } from './control.service.js';
import { EstacionamientosService } from './estacionamientos.service.js';

const municipioParam = { schema: slugMunicipioSchema };

@ApiTags('Estacionamientos')
@ApiBearerAuth()
@Controller('municipios/:municipio/estacionamientos')
export class EstacionamientosController {
  constructor(private readonly estacionamientos: EstacionamientosService) {}

  @Post()
  @ApiOperation({
    summary: 'Inicia un estacionamiento',
    description: 'Queda cubierto hasta `venceEn` según el saldo; al agotarse se cierra solo.',
  })
  @ApiResponse({ status: 201, standardSchema: estacionamientoSchema })
  @ApiResponse({
    status: 409,
    description: 'ESTACIONAMIENTO_EN_CURSO o PATENTE_YA_ESTACIONADA',
  })
  @ApiResponse({ status: 422, description: 'SALDO_INSUFICIENTE o VEHICULO_NO_REGISTRADO' })
  iniciar(
    @Param('municipio', municipioParam) municipio: string,
    @Body({ schema: inicioDeEstacionamientoSchema })
    { zonaId, patente }: z.infer<typeof inicioDeEstacionamientoSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Estacionamiento> {
    return this.estacionamientos.iniciar(usuario.id, municipio, zonaId, patente);
  }

  @Get('activo')
  @ApiOperation({ summary: 'Estacionamiento en curso, o null' })
  @ApiResponse({ status: 200, standardSchema: estacionamientoSchema.nullable() })
  activo(
    @Param('municipio', municipioParam) municipio: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Estacionamiento | null> {
    return this.estacionamientos.activo(usuario.id, municipio);
  }

  @Get()
  @ApiOperation({ summary: 'Historial de estacionamientos (más recientes primero)' })
  @ApiResponse({ status: 200, standardSchema: z.array(estacionamientoSchema) })
  historial(
    @Param('municipio', municipioParam) municipio: string,
    @Query('limite', { schema: z.coerce.number().int().min(1).max(100).default(20) })
    limite: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Estacionamiento[]> {
    return this.estacionamientos.historial(usuario.id, municipio, limite);
  }

  @Post(':id/finalizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finaliza el estacionamiento y cobra el tiempo usado' })
  @ApiResponse({ status: 200, standardSchema: estacionamientoSchema })
  finalizar(
    @Param('municipio', municipioParam) municipio: string,
    @Param('id', { schema: z.uuid() }) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Estacionamiento> {
    return this.estacionamientos.finalizar(usuario.id, municipio, id);
  }
}

@ApiTags('Control')
@ApiBearerAuth()
@Controller('municipios/:municipio/controles')
export class ControlController {
  constructor(private readonly control: ControlService) {}

  @Post()
  @RequiereRol('agente')
  @ApiOperation({
    summary: 'Verifica si un vehículo está habilitado en la ubicación del agente',
    description: 'Cada verificación queda registrada. Requiere rol agente en el municipio.',
  })
  @ApiResponse({ status: 201, standardSchema: controlSchema })
  @ApiResponse({ status: 403, description: 'SIN_PERMISO' })
  controlar(
    @Param('municipio', municipioParam) municipio: string,
    @Body({ schema: solicitudDeControlSchema }) solicitud: z.infer<typeof solicitudDeControlSchema>,
    @UsuarioActual() agente: UsuarioAutenticado,
  ): Promise<Control> {
    return this.control.controlar(agente.id, municipio, solicitud);
  }
}
