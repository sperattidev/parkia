export interface MensajeDeCorreo {
  readonly para: string;
  readonly asunto: string;
  readonly texto: string;
}

/** Puerto de envío de emails; la implementación se elige por configuración. */
export abstract class Correo {
  abstract enviar(mensaje: MensajeDeCorreo): Promise<void>;
}
