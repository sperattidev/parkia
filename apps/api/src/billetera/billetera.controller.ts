import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  billeteraSchema,
  cargaDePruebaSchema,
  slugMunicipioSchema,
  type Billetera,
} from '@parkia/contracts';
import type { z } from 'zod';

import { UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { NoEncontrado } from '../comun/errores.js';
import type { Entorno } from '../config/entorno.js';
import { BilleteraService } from './billetera.service.js';

@ApiTags('Billetera')
@ApiBearerAuth()
@Controller('municipios/:municipio/billetera')
export class BilleteraController {
  constructor(
    private readonly billetera: BilleteraService,
    private readonly config: ConfigService<Entorno, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Saldo y últimos movimientos en el municipio' })
  @ApiResponse({ status: 200, standardSchema: billeteraSchema })
  consultar(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Billetera> {
    return this.billetera.consultar(usuario.id, municipio);
  }

  @Post('cargas-de-prueba')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acredita saldo sin pago real',
    description: 'Solo disponible fuera de producción, hasta integrar Mercado Pago.',
  })
  @ApiResponse({ status: 200, standardSchema: billeteraSchema })
  cargaDePrueba(
    @Param('municipio', { schema: slugMunicipioSchema }) municipio: string,
    @Body({ schema: cargaDePruebaSchema }) { importe }: z.infer<typeof cargaDePruebaSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Billetera> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new NoEncontrado('NO_ENCONTRADO', 'Recurso inexistente.');
    }
    return this.billetera.cargaDePrueba(usuario.id, municipio, importe);
  }
}
