import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { crearPersonal } from '../../src/db/crear-personal.js';
import { sembrar } from '../../src/db/sembrar.js';
import { conToken, crearAppDePrueba, sesionDeConductor, type AppDePrueba } from './app.js';

describe('Autenticación (integración)', () => {
  let prueba: AppDePrueba;

  const post = (url: string, payload: object) =>
    prueba.app.inject({ method: 'POST', url, payload });
  const get = (url: string, token?: string) =>
    prueba.app.inject({ method: 'GET', url, ...(token && { headers: conToken(token) }) });

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    await sembrar(prueba.conexion.db);
    await crearPersonal(prueba.conexion.db, {
      email: 'agente@firmat.gob.ar',
      municipio: 'firmat',
      rol: 'agente',
      contrasena: 'una-contrasena-larga',
    });
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  describe('conductores (código por email)', () => {
    const email = 'vecina@ejemplo.com';

    it('envía un código y responde 202 sin revelar si la cuenta existe', async () => {
      const respuesta = await post('/v1/auth/codigos', { email: '  Vecina@Ejemplo.com ' });
      expect(respuesta.statusCode).toBe(202);
      expect(prueba.correo.ultimoCodigo(email)).toMatch(/^\d{6}$/);
    });

    it('rechaza un código incorrecto', async () => {
      const codigo = prueba.correo.ultimoCodigo(email);
      const incorrecto = codigo === '000000' ? '111111' : '000000';
      const respuesta = await post('/v1/auth/sesiones', { email, codigo: incorrecto });
      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.json()).toMatchObject({ codigo: 'CODIGO_INVALIDO' });
    });

    it('crea la cuenta e inicia sesión con el código correcto', async () => {
      const respuesta = await post('/v1/auth/sesiones', {
        email,
        codigo: prueba.correo.ultimoCodigo(email),
      });
      expect(respuesta.statusCode).toBe(201);
      const sesion = respuesta.json<{ token: string }>();
      expect(respuesta.json()).toMatchObject({ usuario: { email, membresias: [] } });

      const yo = await get('/v1/auth/yo', sesion.token);
      expect(yo.statusCode).toBe(200);
      expect(yo.json()).toMatchObject({ email });
    });

    it('no permite reutilizar un código', async () => {
      const respuesta = await post('/v1/auth/sesiones', {
        email,
        codigo: prueba.correo.ultimoCodigo(email),
      });
      expect(respuesta.statusCode).toBe(401);
    });

    it('invalida el código tras demasiados intentos fallidos', async () => {
      const otro = 'bloqueo@ejemplo.com';
      await prueba.autenticacion.solicitarCodigo(otro);
      const correcto = prueba.correo.ultimoCodigo(otro);
      const incorrecto = correcto === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) {
        await expect(
          prueba.autenticacion.ingresarConCodigo(otro, incorrecto, {}),
        ).rejects.toMatchObject({ codigo: 'CODIGO_INVALIDO' });
      }
      await expect(
        prueba.autenticacion.ingresarConCodigo(otro, correcto, {}),
      ).rejects.toMatchObject({ codigo: 'CODIGO_INVALIDO' });
    });

    it('un código nuevo invalida el anterior', async () => {
      const otro = 'reenvio@ejemplo.com';
      await prueba.autenticacion.solicitarCodigo(otro);
      const viejo = prueba.correo.ultimoCodigo(otro);
      await prueba.autenticacion.solicitarCodigo(otro);
      const nuevo = prueba.correo.ultimoCodigo(otro);
      if (viejo !== nuevo) {
        await expect(prueba.autenticacion.ingresarConCodigo(otro, viejo, {})).rejects.toMatchObject(
          { codigo: 'CODIGO_INVALIDO' },
        );
      }
      await expect(prueba.autenticacion.ingresarConCodigo(otro, nuevo, {})).resolves.toHaveProperty(
        'token',
      );
    });
  });

  describe('personal municipal (contraseña)', () => {
    it('inicia sesión con contraseña y expone sus membresías', async () => {
      const respuesta = await post('/v1/auth/sesiones/contrasena', {
        email: 'agente@firmat.gob.ar',
        contrasena: 'una-contrasena-larga',
      });
      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json()).toMatchObject({
        usuario: { membresias: [{ municipio: 'firmat', rol: 'agente' }] },
      });
    });

    it('responde igual ante contraseña incorrecta o email inexistente', async () => {
      const incorrecta = await post('/v1/auth/sesiones/contrasena', {
        email: 'agente@firmat.gob.ar',
        contrasena: 'otra-contrasena',
      });
      const inexistente = await post('/v1/auth/sesiones/contrasena', {
        email: 'nadie@firmat.gob.ar',
        contrasena: 'otra-contrasena',
      });
      expect(incorrecta.statusCode).toBe(401);
      expect(inexistente.statusCode).toBe(401);
      expect(incorrecta.json()).toEqual(inexistente.json());
    });
  });

  describe('sesiones', () => {
    it('exige token en las rutas protegidas', async () => {
      const respuesta = await get('/v1/auth/yo');
      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.json()).toMatchObject({ codigo: 'NO_AUTENTICADO' });
    });

    it('rechaza tokens inventados', async () => {
      expect((await get('/v1/auth/yo', 'token-inventado')).statusCode).toBe(401);
    });

    it('cierra la sesión y el token deja de servir', async () => {
      const token = await sesionDeConductor(prueba, 'cierre@ejemplo.com');
      const cierre = await prueba.app.inject({
        method: 'DELETE',
        url: '/v1/auth/sesiones/actual',
        headers: conToken(token),
      });
      expect(cierre.statusCode).toBe(204);
      expect((await get('/v1/auth/yo', token)).statusCode).toBe(401);
    });

    it('las rutas públicas siguen accesibles sin token', async () => {
      expect((await get('/v1/municipios/firmat/zonas')).statusCode).toBe(200);
    });
  });

  // Va al final: agota el cupo de la IP de pruebas en ese endpoint.
  it('limita los intentos por IP en los endpoints de credenciales', async () => {
    let ultima = await post('/v1/auth/sesiones/contrasena', { email: 'x@y.com', contrasena: 'x' });
    for (let i = 0; i < 6; i++) {
      ultima = await post('/v1/auth/sesiones/contrasena', { email: 'x@y.com', contrasena: 'x' });
    }
    expect(ultima.statusCode).toBe(429);
    expect(ultima.json()).toMatchObject({ codigo: 'DEMASIADAS_SOLICITUDES' });
  });
});
