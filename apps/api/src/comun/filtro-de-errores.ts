import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ErrorDeDominio } from '@parkia/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ErrorDeApi, type CuerpoDeError } from './errores.js';

const CODIGOS_HTTP: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'SOLICITUD_INVALIDA',
  [HttpStatus.UNAUTHORIZED]: 'NO_AUTENTICADO',
  [HttpStatus.FORBIDDEN]: 'SIN_PERMISO',
  [HttpStatus.NOT_FOUND]: 'NO_ENCONTRADO',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METODO_NO_PERMITIDO',
  [HttpStatus.CONFLICT]: 'CONFLICTO',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'CONTENIDO_DEMASIADO_GRANDE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'TIPO_NO_SOPORTADO',
  [HttpStatus.TOO_MANY_REQUESTS]: 'DEMASIADAS_SOLICITUDES',
};

function mensajeDe(respuesta: string | object, porDefecto: string): string {
  if (typeof respuesta === 'string') return respuesta;
  const { message } = respuesta as { message?: unknown };
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' ? message : porDefecto;
}

/**
 * Traduce cualquier error a un cuerpo uniforme `{ statusCode, codigo, mensaje }`.
 * Los errores no previstos se registran completos y al cliente solo le llega un
 * mensaje genérico: nunca se filtran detalles internos.
 */
@Catch()
export class FiltroDeErrores implements ExceptionFilter {
  private readonly logger = new Logger(FiltroDeErrores.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const respuesta = http.getResponse<FastifyReply>();
    const cuerpo = this.cuerpoPara(error, http.getRequest<FastifyRequest>());
    void respuesta.status(cuerpo.statusCode).send(cuerpo);
  }

  private cuerpoPara(error: unknown, solicitud: FastifyRequest): CuerpoDeError {
    if (error instanceof ErrorDeApi) {
      return error.getResponse() as CuerpoDeError;
    }
    if (error instanceof ErrorDeDominio) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        codigo: error.codigo,
        mensaje: error.message,
      };
    }
    if (error instanceof HttpException) {
      const statusCode = error.getStatus();
      return {
        statusCode,
        codigo: CODIGOS_HTTP[statusCode] ?? 'ERROR_HTTP',
        mensaje: mensajeDe(error.getResponse(), error.message),
      };
    }

    this.logger.error(
      { err: error, metodo: solicitud.method, ruta: solicitud.url },
      'Error no controlado',
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error inesperado. Ya fue registrado.',
    };
  }
}
