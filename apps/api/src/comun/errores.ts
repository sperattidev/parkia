import { HttpException, HttpStatus } from '@nestjs/common';

/** Cuerpo uniforme de todas las respuestas de error de la API. */
export interface CuerpoDeError {
  readonly statusCode: number;
  readonly codigo: string;
  readonly mensaje: string;
  readonly detalles?: readonly { readonly campo: string; readonly mensaje: string }[];
}

/** Error HTTP con un código estable que los clientes pueden interpretar. */
export class ErrorDeApi extends HttpException {
  constructor(
    status: HttpStatus,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: CuerpoDeError['detalles'],
  ) {
    super(
      {
        statusCode: status,
        codigo,
        mensaje,
        ...(detalles ? { detalles } : {}),
      } satisfies CuerpoDeError,
      status,
    );
  }
}

export class NoEncontrado extends ErrorDeApi {
  constructor(codigo: string, mensaje: string) {
    super(HttpStatus.NOT_FOUND, codigo, mensaje);
  }
}
