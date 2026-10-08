import {
  createParamDecorator,
  HttpStatus,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { RolMunicipal } from '@parkia/contracts';
import type { FastifyRequest } from 'fastify';

import { ErrorDeApi } from '../comun/errores.js';
import type { UsuarioAutenticado } from './tipos.js';

export const ES_PUBLICO = 'parkia:publico';
export const ROLES_REQUERIDOS = 'parkia:roles';
export const SOLO_PARKIA = 'parkia:solo-parkia';
export const CON_CONTRASENA_TEMPORAL = 'parkia:con-contrasena-temporal';

/** La ruta no requiere sesión. Todo lo demás exige `Authorization: Bearer`. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

/**
 * Exige alguno de los roles en el municipio de la ruta (parámetro `:municipio`).
 * Un admin del municipio siempre tiene acceso.
 */
export const RequiereRol = (...roles: RolMunicipal[]) => SetMetadata(ROLES_REQUERIDOS, roles);

/** Solo el equipo de Parkia (alta de municipios y soporte). */
export const SoloParkia = () => SetMetadata(SOLO_PARKIA, true);

/**
 * Ruta disponible aunque la contraseña sea temporal (ver quién soy, cambiarla
 * o salir). Todas las demás exigen cambiarla primero.
 */
export const ConContrasenaTemporal = () => SetMetadata(CON_CONTRASENA_TEMPORAL, true);

export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const { usuario } = contexto.switchToHttp().getRequest<FastifyRequest>();
    if (!usuario) {
      throw new ErrorDeApi(
        HttpStatus.UNAUTHORIZED,
        'NO_AUTENTICADO',
        'Iniciá sesión para continuar.',
      );
    }
    return usuario;
  },
);
