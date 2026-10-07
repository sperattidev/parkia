import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ingresoConCodigoSchema,
  ingresoConContrasenaSchema,
  sesionSchema,
  solicitudDeCodigoSchema,
  usuarioSchema,
  type Sesion,
  type Usuario,
} from '@parkia/contracts';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { AutenticacionService, type DatosDeConexion } from './autenticacion.service.js';
import { Publico, UsuarioActual } from './decoradores.js';
import type { UsuarioAutenticado } from './tipos.js';

/** Límite estricto para endpoints que aceptan credenciales: 5 por minuto por IP. */
const LIMITE_CREDENCIALES = { default: { limit: 5, ttl: 60_000 } };

function datosDeConexion(solicitud: FastifyRequest): DatosDeConexion {
  return { ip: solicitud.ip, agenteDeUsuario: solicitud.headers['user-agent'] };
}

@ApiTags('Autenticación')
@Controller('auth')
export class AutenticacionController {
  constructor(private readonly autenticacion: AutenticacionService) {}

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @Post('codigos')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Envía un código de acceso por email',
    description: 'Responde 202 siempre, exista o no la cuenta.',
  })
  async solicitarCodigo(
    @Body({ schema: solicitudDeCodigoSchema }) { email }: z.infer<typeof solicitudDeCodigoSchema>,
  ): Promise<void> {
    await this.autenticacion.solicitarCodigo(email);
  }

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @Post('sesiones')
  @ApiOperation({ summary: 'Inicia sesión con el código recibido por email (conductores)' })
  @ApiResponse({ status: 201, standardSchema: sesionSchema })
  @ApiResponse({ status: 401, description: 'CODIGO_INVALIDO' })
  ingresarConCodigo(
    @Body({ schema: ingresoConCodigoSchema })
    { email, codigo }: z.infer<typeof ingresoConCodigoSchema>,
    @Req() solicitud: FastifyRequest,
  ): Promise<Sesion> {
    return this.autenticacion.ingresarConCodigo(email, codigo, datosDeConexion(solicitud));
  }

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @Post('sesiones/contrasena')
  @ApiOperation({ summary: 'Inicia sesión con contraseña (personal municipal)' })
  @ApiResponse({ status: 201, standardSchema: sesionSchema })
  @ApiResponse({ status: 401, description: 'CREDENCIALES_INVALIDAS' })
  ingresarConContrasena(
    @Body({ schema: ingresoConContrasenaSchema })
    { email, contrasena }: z.infer<typeof ingresoConContrasenaSchema>,
    @Req() solicitud: FastifyRequest,
  ): Promise<Sesion> {
    return this.autenticacion.ingresarConContrasena(email, contrasena, datosDeConexion(solicitud));
  }

  @Delete('sesiones/actual')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cierra la sesión actual' })
  async cerrarSesion(@UsuarioActual() usuario: UsuarioAutenticado): Promise<void> {
    await this.autenticacion.cerrarSesion(usuario.sesionId);
  }

  @Get('yo')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario de la sesión actual' })
  @ApiResponse({ status: 200, standardSchema: usuarioSchema })
  yo(@UsuarioActual() usuario: UsuarioAutenticado): Usuario {
    return this.autenticacion.aUsuario(usuario);
  }
}
