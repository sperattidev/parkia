import { describe, expect, it, vi } from 'vitest';

import { CorreoResend } from '../../src/correo/correo-resend.js';

const mensaje = { para: 'vecina@ejemplo.com', asunto: 'Código', texto: 'Tu código: 123456' };

describe('CorreoResend', () => {
  it('envía el email con la API key', async () => {
    const fetchFalso = vi.fn(() => Promise.resolve(new Response('{"id":"1"}', { status: 200 })));
    await new CorreoResend('re_clave', 'Parkia <no@parkia.net.ar>', fetchFalso).enviar(mensaje);

    const [url, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opciones.headers).toMatchObject({ Authorization: 'Bearer re_clave' });
    expect(JSON.parse(opciones.body as string)).toEqual({
      from: 'Parkia <no@parkia.net.ar>',
      to: ['vecina@ejemplo.com'],
      subject: 'Código',
      text: 'Tu código: 123456',
    });
  });

  it('envía también la versión HTML cuando la hay', async () => {
    const fetchFalso = vi.fn(() => Promise.resolve(new Response('{"id":"1"}', { status: 200 })));
    await new CorreoResend('re_clave', 'x', fetchFalso).enviar({ ...mensaje, html: '<p>Hola</p>' });

    const [, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(opciones.body as string)).toMatchObject({
      text: 'Tu código: 123456',
      html: '<p>Hola</p>',
    });
  });

  it('falla si Resend rechaza el envío', async () => {
    const fetchFalso = vi.fn(() =>
      Promise.resolve(new Response('dominio no verificado', { status: 403 })),
    );
    await expect(new CorreoResend('re_clave', 'x', fetchFalso).enviar(mensaje)).rejects.toThrow(
      /403/,
    );
  });
});
