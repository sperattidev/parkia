import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  cotizacionSchema,
  cotizacionSolicitudSchema,
  ladoSchema,
  lugaresDeManoSchema,
  mapaSchema,
  slugMunicipioSchema,
  ubicacionEnCuadraSchema,
  ubicacionSchema,
  type Cotizacion,
  type CotizacionSolicitud,
  type LugaresDeMano,
  type Mapa,
  type Ubicacion,
  type UbicacionEnCuadra,
} from '@parkia/contracts';
import type { Lado } from '@parkia/domain';
import { z } from 'zod';

import { Publico } from '../autenticacion/decoradores.js';
import { ZonasService } from './zonas.service.js';

@Publico()
@ApiTags('Zonas y cuadras')
@Controller('municipios/:municipio')
export class ZonasController {
  constructor(private readonly zonas: ZonasService) {}

  @Get('mapa')
  @ApiOperation({
    summary: 'Zonas tarifadas y sus cuadras (GeoJSON), con la ocupación en este momento',
  })
  @ApiResponse({ status: 200, standardSchema: mapaSchema })
  mapa(@Param('municipio', { schema: slugMunicipioSchema }) municipio: string): Promise<Mapa> {
    return this.zonas.mapa(municipio);
  }

  @Get('ubicar')
  @ApiOperation({
    summary: 'Cuadra, mano y altura en una ubicación, y si se cobra en este momento',
  })
  @ApiResponse({ status: 200, standardSchema: ubicacionEnCuadraSchema })
  @ApiResponse({ status: 404, description: 'FUERA_DE_ZONA o MUNICIPIO_NO_ENCONTRADO' })
  ubicar(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
    @Query({ schema: ubicacionSchema }) ubicacion: Ubicacion,
  ): Promise<UbicacionEnCuadra> {
    return this.zonas.ubicar(municipio, ubicacion);
  }

  @Get('cuadras/:cuadra/lugares')
  @ApiOperation({ summary: 'Capacidad y lugares ocupados de una mano de la cuadra' })
  @ApiResponse({ status: 200, standardSchema: lugaresDeManoSchema })
  @ApiResponse({ status: 404, description: 'CUADRA_NO_ENCONTRADA' })
  lugares(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
    @Param('cuadra', { schema: z.uuid() }) cuadra: string,
    @Query('lado', { schema: ladoSchema }) lado: Lado,
  ): Promise<LugaresDeMano> {
    return this.zonas.lugaresDeMano(municipio, cuadra, lado);
  }

  @Post('cotizaciones')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calcula el costo de un estacionamiento sin registrarlo' })
  @ApiResponse({ status: 200, standardSchema: cotizacionSchema })
  @ApiResponse({
    status: 422,
    description: 'Período inválido (por ejemplo, fin anterior al inicio)',
  })
  cotizar(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
    @Body({ schema: cotizacionSolicitudSchema }) solicitud: CotizacionSolicitud,
  ): Promise<Cotizacion> {
    return this.zonas.cotizar(municipio, solicitud);
  }
}
