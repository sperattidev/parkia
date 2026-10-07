import { BadRequestException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { ErrorDeDominio } from '@parkia/domain';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { NoEncontrado } from '../../src/comun/errores.js';
import { FiltroDeErrores } from '../../src/comun/filtro-de-errores.js';

function hostFalso() {
  const respuesta = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => respuesta,
      getRequest: () => ({ method: 'GET', url: '/v1/prueba' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, respuesta };
}

describe('FiltroDeErrores', () => {
  const filtro = new FiltroDeErrores();
  let registrarError: MockInstance<Logger['error']>;

  beforeEach(() => {
    registrarError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('respeta los errores de la API con su código', () => {
    const { host, respuesta } = hostFalso();
    filtro.catch(new NoEncontrado('ZONA_NO_ENCONTRADA', 'No existe.'), host);
    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(respuesta.send).toHaveBeenCalledWith({
      statusCode: 404,
      codigo: 'ZONA_NO_ENCONTRADA',
      mensaje: 'No existe.',
    });
  });

  it('convierte errores de dominio en 422', () => {
    const { host, respuesta } = hostFalso();
    filtro.catch(new ErrorDeDominio('PERIODO_INVALIDO', 'Fin anterior al inicio.'), host);
    expect(respuesta.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(respuesta.send).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 'PERIODO_INVALIDO' }),
    );
  });

  it('asigna un código a las excepciones HTTP de NestJS', () => {
    const { host, respuesta } = hostFalso();
    filtro.catch(new BadRequestException(['a inválido', 'b inválido']), host);
    expect(respuesta.send).toHaveBeenCalledWith({
      statusCode: 400,
      codigo: 'SOLICITUD_INVALIDA',
      mensaje: 'a inválido; b inválido',
    });
  });

  it('no filtra detalles de errores inesperados y los registra', () => {
    const { host, respuesta } = hostFalso();
    filtro.catch(new Error('contraseña de la base: secreta'), host);
    expect(respuesta.status).toHaveBeenCalledWith(500);
    const cuerpo = respuesta.send.mock.calls[0]?.[0] as { mensaje: string; codigo: string };
    expect(cuerpo.codigo).toBe('ERROR_INTERNO');
    expect(cuerpo.mensaje).not.toContain('secreta');
    expect(registrarError).toHaveBeenCalled();
  });
});
