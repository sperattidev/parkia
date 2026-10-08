import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  altaDeMunicipioSchema,
  cambioDeMunicipioSchema,
  municipioDePlataformaSchema,
  municipioNuevoSchema,
  slugMunicipioSchema,
  type AltaDeMunicipio,
  type MunicipioDePlataforma,
} from '@parkia/contracts';
import { z } from 'zod';

import { SoloParkia, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { PlataformaService } from './plataforma.service.js';

@ApiTags('Plataforma (equipo de Parkia)')
@ApiBearerAuth()
@SoloParkia()
@Controller('plataforma')
export class PlataformaController {
  constructor(private readonly plataforma: PlataformaService) {}

  @Get('municipios')
  @ApiOperation({ summary: 'Municipios clientes con sus indicadores' })
  @ApiResponse({ status: 200, standardSchema: z.array(municipioDePlataformaSchema) })
  municipios(): Promise<MunicipioDePlataforma[]> {
    return this.plataforma.municipios();
  }

  @Post('municipios')
  @ApiOperation({
    summary: 'Da de alta un municipio y su primer administrador',
    description: 'El administrador recibe una contraseña temporal que se muestra una sola vez.',
  })
  @ApiResponse({ status: 201, standardSchema: altaDeMunicipioSchema })
  @ApiResponse({ status: 409, description: 'MUNICIPIO_EXISTENTE o EMAIL_DE_CONDUCTOR' })
  crear(
    @Body({ schema: municipioNuevoSchema }) nuevo: z.infer<typeof municipioNuevoSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<AltaDeMunicipio> {
    return this.plataforma.crear(usuario, nuevo);
  }

  @Patch('municipios/:municipio')
  @ApiOperation({ summary: 'Cambia los datos de un municipio o lo desactiva' })
  @ApiResponse({ status: 200, standardSchema: municipioDePlataformaSchema })
  cambiar(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
    @Body({ schema: cambioDeMunicipioSchema }) cambio: z.infer<typeof cambioDeMunicipioSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<MunicipioDePlataforma> {
    return this.plataforma.cambiar(usuario, municipio, cambio);
  }
}
