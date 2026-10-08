import type { AltaDeMunicipio, MunicipioDePlataforma, Persona, Usuario } from '@parkia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { crearPersonal } from '../../src/db/crear-personal.js';
import { sembrar } from '../../src/db/sembrar.js';
import { conToken, crearAppDePrueba, sesionDePersonal, type AppDePrueba } from './app.js';

describe('Panel de Parkia (integración)', () => {
  let prueba: AppDePrueba;
  let parkia: string;
  let adminDeFirmat: string;

  const pedir = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
    prueba.app.inject({ method, url, headers: conToken(token), ...(payload && { payload }) });

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    await sembrar(prueba.conexion.db);
    await crearPersonal(prueba.conexion.db, {
      email: 'equipo@parkia.net.ar',
      contrasena: 'clave-del-equipo-parkia',
      administradorDeParkia: true,
    });
    await crearPersonal(prueba.conexion.db, {
      email: 'admin@firmat.gob.ar',
      municipio: 'firmat',
      rol: 'admin',
      contrasena: 'clave-del-admin-firmat',
    });
    parkia = await sesionDePersonal(prueba, 'equipo@parkia.net.ar', 'clave-del-equipo-parkia');
    adminDeFirmat = await sesionDePersonal(prueba, 'admin@firmat.gob.ar', 'clave-del-admin-firmat');
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  it('es exclusivo del equipo de Parkia', async () => {
    const respuesta = await pedir('GET', '/v1/plataforma/municipios', adminDeFirmat);
    expect(respuesta.statusCode).toBe(403);
    expect((await pedir('GET', '/v1/auth/yo', parkia)).json<Usuario>()).toMatchObject({
      administradorDeParkia: true,
      membresias: [],
    });
  });

  it('lista los municipios con sus indicadores', async () => {
    const municipios = (await pedir('GET', '/v1/plataforma/municipios', parkia)).json<
      MunicipioDePlataforma[]
    >();
    expect(municipios).toMatchObject([
      { slug: 'firmat', activo: true, zonas: 2, cuadras: 30, personal: 1, estacionamientosHoy: 0 },
    ]);
  });

  it('el equipo de Parkia puede entrar al panel de cualquier municipio', async () => {
    expect((await pedir('GET', '/v1/municipios/firmat/gestion/personal', parkia)).statusCode).toBe(
      200,
    );
  });

  describe('alta de un municipio', () => {
    let alta: AltaDeMunicipio;

    it('crea el municipio con su primer administrador', async () => {
      const respuesta = await pedir('POST', '/v1/plataforma/municipios', parkia, {
        slug: 'venado-tuerto',
        nombre: 'Venado Tuerto',
        provincia: 'Santa Fe',
        administrador: { email: 'transito@venadotuerto.gob.ar', nombre: 'Dirección de Tránsito' },
      });
      expect(respuesta.statusCode).toBe(201);
      alta = respuesta.json<AltaDeMunicipio>();
      expect(alta.municipio).toMatchObject({
        slug: 'venado-tuerto',
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        activo: true,
        personal: 1,
        zonas: 0,
      });
      expect(alta.administrador.persona).toMatchObject({
        rol: 'admin',
        debeCambiarContrasena: true,
      });
    });

    it('su administrador entra a su municipio y no a otros', async () => {
      const token = await sesionDePersonal(
        prueba,
        'transito@venadotuerto.gob.ar',
        alta.administrador.contrasenaTemporal ?? '',
      );
      await pedir('POST', '/v1/auth/contrasena', token, {
        actual: alta.administrador.contrasenaTemporal,
        nueva: 'clave-nueva-de-venado',
      });
      const propio = await pedir('GET', '/v1/municipios/venado-tuerto/gestion/personal', token);
      expect(propio.json<Persona[]>()).toHaveLength(1);
      expect((await pedir('GET', '/v1/municipios/firmat/gestion/personal', token)).statusCode).toBe(
        403,
      );
    });

    it('no repite identificadores', async () => {
      const respuesta = await pedir('POST', '/v1/plataforma/municipios', parkia, {
        slug: 'venado-tuerto',
        nombre: 'Otro',
        provincia: 'Santa Fe',
        administrador: { email: 'otro@ejemplo.gob.ar', nombre: 'Otro' },
      });
      expect(respuesta.json()).toMatchObject({ codigo: 'MUNICIPIO_EXISTENTE' });
    });

    it('desactivar un municipio lo saca de línea', async () => {
      const respuesta = await pedir('PATCH', '/v1/plataforma/municipios/venado-tuerto', parkia, {
        activo: false,
      });
      expect(respuesta.json<MunicipioDePlataforma>().activo).toBe(false);
      const publico = await prueba.app.inject({
        method: 'GET',
        url: '/v1/municipios/venado-tuerto',
      });
      expect(publico.statusCode).toBe(404);
    });
  });
});
