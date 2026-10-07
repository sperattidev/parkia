import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { municipioSchema, slugMunicipioSchema, type MunicipioPublico } from '@parkia/contracts';

import { Publico } from '../autenticacion/decoradores.js';
import { MunicipiosService } from './municipios.service.js';

@Publico()
@ApiTags('Municipios')
@Controller('municipios')
export class MunicipiosController {
  constructor(private readonly municipios: MunicipiosService) {}

  @Get(':municipio')
  @ApiOperation({ summary: 'Datos públicos del municipio' })
  @ApiResponse({ status: 200, standardSchema: municipioSchema })
  async obtener(
    @Param('municipio', { schema: slugMunicipioSchema }) slug: string,
  ): Promise<MunicipioPublico> {
    const { nombre, provincia, zonaHoraria } = await this.municipios.porSlug(slug);
    return { slug, nombre, provincia, zonaHoraria };
  }
}
