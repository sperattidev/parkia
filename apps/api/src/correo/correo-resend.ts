import { Correo, type MensajeDeCorreo } from './correo.js';

/** Envío por la API HTTP de Resend (https://resend.com/docs/api-reference/emails/send-email). */
export class CorreoResend extends Correo {
  constructor(
    private readonly apiKey: string,
    private readonly remitente: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
  }

  async enviar(mensaje: MensajeDeCorreo): Promise<void> {
    const respuesta = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.remitente,
        to: [mensaje.para],
        subject: mensaje.asunto,
        text: mensaje.texto,
        ...(mensaje.html && { html: mensaje.html }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) {
      throw new Error(`Resend respondió ${respuesta.status}: ${await respuesta.text()}`);
    }
  }
}
