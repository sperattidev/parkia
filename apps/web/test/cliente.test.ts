import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeParkia, mensajeDeError, pedir } from '@/lib/cliente';

const respuesta = (status: number, cuerpo?: unknown) =>
  Promise.resolve(
    new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

describe('cliente', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envía el encabezado anti-CSRF y el cuerpo como JSON', async () => {
    const fetchFalso = vi.fn(() => respuesta(200, { ok: true }));
    vi.stubGlobal('fetch', fetchFalso);
    await pedir('/api/codigo', { metodo: 'POST', cuerpo: { email: 'a@b.com' } });

    const [, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(opciones.headers).toMatchObject({ 'x-parkia': '1', 'content-type': 'application/json' });
    expect(opciones.body).toBe('{"email":"a@b.com"}');
  });

  it('convierte el error de la API en ErrorDeParkia con su código', async () => {
    vi.stubGlobal('fetch', () =>
      respuesta(422, { codigo: 'SALDO_INSUFICIENTE', mensaje: 'El saldo no alcanza.' }),
    );
    await expect(pedir('/api/parkia/x')).rejects.toMatchObject({
      status: 422,
      codigo: 'SALDO_INSUFICIENTE',
      message: 'El saldo no alcanza.',
    });
  });

  it('informa la falta de conexión', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('fetch failed')));
    await expect(pedir('/api/parkia/x')).rejects.toMatchObject({ codigo: 'SIN_CONEXION' });
  });

  it('prioriza el detalle de validación en el mensaje al usuario', () => {
    const error = new ErrorDeParkia(400, 'VALIDACION', 'Datos inválidos.', [
      { campo: 'patente', mensaje: 'No es una patente válida.' },
    ]);
    expect(mensajeDeError(error)).toBe('No es una patente válida.');
    expect(mensajeDeError(new Error('x'))).toBe('Ocurrió un error inesperado.');
  });

  it('devuelve undefined en respuestas sin cuerpo', async () => {
    vi.stubGlobal('fetch', () => respuesta(204));
    await expect(pedir('/api/sesion', { metodo: 'DELETE' })).resolves.toBeUndefined();
  });
});
