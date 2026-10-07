import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { vehiculoNuevoSchema, vehiculoSchema, type Vehiculo } from '@parkia/contracts';
import { and, asc, count, eq } from 'drizzle-orm';
import { z } from 'zod';

import { UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { ErrorDeApi, NoEncontrado } from '../comun/errores.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { esViolacionDeUnicidad } from '../db/errores-pg.js';
import { vehiculos } from '../db/esquema.js';

/** Límite razonable por cuenta (familia, flota chica). */
export const MAX_VEHICULOS = 10;

const columnas = { id: vehiculos.id, patente: vehiculos.patente, alias: vehiculos.alias };

@ApiTags('Vehículos')
@ApiBearerAuth()
@Controller('vehiculos')
export class VehiculosController {
  constructor(@Inject(CONEXION) private readonly conexion: Conexion) {}

  @Get()
  @ApiOperation({ summary: 'Vehículos de la cuenta' })
  @ApiResponse({ status: 200, standardSchema: z.array(vehiculoSchema) })
  listar(@UsuarioActual() usuario: UsuarioAutenticado): Promise<Vehiculo[]> {
    return this.conexion.db
      .select(columnas)
      .from(vehiculos)
      .where(eq(vehiculos.usuarioId, usuario.id))
      .orderBy(asc(vehiculos.creadoEn));
  }

  @Post()
  @ApiOperation({ summary: 'Agrega un vehículo por su patente' })
  @ApiResponse({ status: 201, standardSchema: vehiculoSchema })
  @ApiResponse({ status: 409, description: 'VEHICULO_DUPLICADO o LIMITE_DE_VEHICULOS' })
  async agregar(
    @Body({ schema: vehiculoNuevoSchema }) datos: z.infer<typeof vehiculoNuevoSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Vehiculo> {
    const [{ total } = { total: 0 }] = await this.conexion.db
      .select({ total: count() })
      .from(vehiculos)
      .where(eq(vehiculos.usuarioId, usuario.id));
    if (total >= MAX_VEHICULOS) {
      throw new ErrorDeApi(
        HttpStatus.CONFLICT,
        'LIMITE_DE_VEHICULOS',
        `Se pueden registrar hasta ${MAX_VEHICULOS} vehículos por cuenta.`,
      );
    }

    try {
      const [vehiculo] = await this.conexion.db
        .insert(vehiculos)
        .values({ usuarioId: usuario.id, patente: datos.patente, alias: datos.alias ?? null })
        .returning(columnas);
      if (!vehiculo) throw new Error('No se pudo registrar el vehículo.');
      return vehiculo;
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ErrorDeApi(
          HttpStatus.CONFLICT,
          'VEHICULO_DUPLICADO',
          `La patente ${datos.patente} ya está en tu cuenta.`,
        );
      }
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita un vehículo de la cuenta' })
  async quitar(
    @Param('id', { schema: z.uuid() }) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    const borrados = await this.conexion.db
      .delete(vehiculos)
      .where(and(eq(vehiculos.id, id), eq(vehiculos.usuarioId, usuario.id)))
      .returning({ id: vehiculos.id });
    if (borrados.length === 0) {
      throw new NoEncontrado('VEHICULO_NO_ENCONTRADO', 'El vehículo no existe en tu cuenta.');
    }
  }
}
