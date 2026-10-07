import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  cotizacionSchema,
  cotizacionSolicitudSchema,
  slugMunicipioSchema,
  ubicacionSchema,
  zonaResumenSchema,
  zonasGeoJsonSchema,
  type Cotizacion,
  type CotizacionSolicitud,
  type Ubicacion,
  type ZonaResumen,
  type ZonasGeoJson,
} from '@parkia/contracts';

import { Publico } from '../autenticacion/decoradores.js';
import { ZonasService } from './zonas.service.js';

@Publico()
@ApiTags('Zonas')
@Controller('municipios/:municipio')
export class ZonasController {
  constructor(private readonly zonas: ZonasService) {}

  @Get('zonas')
  @ApiOperation({ summary: 'Zonas tarifadas del municipio (GeoJSON)' })
  @ApiResponse({ status: 200, standardSchema: zonasGeoJsonSchema })
  listar(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
  ): Promise<ZonasGeoJson> {
    return this.zonas.listar(municipio);
  }

  @Get('zonas/ubicar')
  @ApiOperation({ summary: 'Zona tarifada en una ubicación y si se cobra en este momento' })
  @ApiResponse({ status: 200, standardSchema: zonaResumenSchema })
  @ApiResponse({ status: 404, description: 'FUERA_DE_ZONA o MUNICIPIO_NO_ENCONTRADO' })
  ubicar(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
    @Query({ schema: ubicacionSchema }) ubicacion: Ubicacion,
  ): Promise<ZonaResumen> {
    return this.zonas.ubicar(municipio, ubicacion);
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
