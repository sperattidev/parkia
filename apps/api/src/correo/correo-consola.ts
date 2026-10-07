import { Logger } from '@nestjs/common';

import { Correo, type MensajeDeCorreo } from './correo.js';

/** Solo para desarrollo: muestra el email en el log en lugar de enviarlo. */
export class CorreoConsola extends Correo {
  private readonly logger = new Logger('Correo');

  enviar(mensaje: MensajeDeCorreo): Promise<void> {
    this.logger.warn(`[no enviado] Para: ${mensaje.para} · ${mensaje.asunto}\n${mensaje.texto}`);
    return Promise.resolve();
  }
}
