import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolMunicipal } from '@parkia/contracts';
import type { FastifyRequest } from 'fastify';

import { ErrorDeApi } from '../comun/errores.js';
import { AutenticacionService } from './autenticacion.service.js';
import {
  CON_CONTRASENA_TEMPORAL,
  ES_PUBLICO,
  ROLES_REQUERIDOS,
  SOLO_PARKIA,
} from './decoradores.js';

function tokenBearer(solicitud: FastifyRequest): string | null {
  const [esquema, token] = (solicitud.headers.authorization ?? '').split(' ');
  return esquema?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Guardia global: toda ruta exige sesión salvo las marcadas con `@Publico()`.
 * Con `@RequiereRol(...)` además verifica la membresía en el municipio de la ruta
 * (el equipo de Parkia tiene acceso a todos, para dar soporte) y con
 * `@SoloParkia()`, que sea del equipo de Parkia.
 */
@Injectable()
export class GuardiaDeAutenticacion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly autenticacion: AutenticacionService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    const solicitud = contexto.switchToHttp().getRequest<FastifyRequest>();
    const token = tokenBearer(solicitud);
    const usuario = token ? await this.autenticacion.autenticar(token) : null;
    if (usuario) solicitud.usuario = usuario;

    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, objetivos)) return true;

    if (!usuario) {
      throw new ErrorDeApi(
        HttpStatus.UNAUTHORIZED,
        'NO_AUTENTICADO',
        'Iniciá sesión para continuar.',
      );
    }

    if (
      usuario.debeCambiarContrasena &&
      !this.reflector.getAllAndOverride<boolean>(CON_CONTRASENA_TEMPORAL, objetivos)
    ) {
      throw new ErrorDeApi(
        HttpStatus.FORBIDDEN,
        'CAMBIO_DE_CONTRASENA_REQUERIDO',
        'Antes de seguir, cambiá la contraseña temporal que te asignaron.',
      );
    }

    if (this.reflector.getAllAndOverride<boolean>(SOLO_PARKIA, objetivos)) {
      if (usuario.administradorDeParkia) return true;
      throw new ErrorDeApi(
        HttpStatus.FORBIDDEN,
        'SIN_PERMISO',
        'Esta operación es exclusiva del equipo de Parkia.',
      );
    }

    const roles = this.reflector.getAllAndOverride<RolMunicipal[] | undefined>(
      ROLES_REQUERIDOS,
      objetivos,
    );
    if (!roles?.length) return true;

    const { municipio } = solicitud.params as { municipio?: string };
    if (usuario.administradorDeParkia) return true;
    const autorizado = usuario.membresias.some(
      (membresia) =>
        membresia.municipio === municipio &&
        (membresia.rol === 'admin' || roles.includes(membresia.rol)),
    );
    if (!autorizado) {
      throw new ErrorDeApi(
        HttpStatus.FORBIDDEN,
        'SIN_PERMISO',
        'No tenés permiso para esta operación en este municipio.',
      );
    }
    return true;
  }
}
