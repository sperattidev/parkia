/**
 * Error de una regla de negocio. El `codigo` es estable y apto para que la API
 * lo traduzca a una respuesta; el mensaje es para humanos y puede cambiar.
 */
export class ErrorDeDominio extends Error {
  override readonly name = 'ErrorDeDominio';

  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}
