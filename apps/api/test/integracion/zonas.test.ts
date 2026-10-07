import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sembrar } from '../../src/db/sembrar.js';
import { crearAppDePrueba, type AppDePrueba } from './app.js';

const DENTRO = { lat: -33.46, lng: -61.4875 };
const FUERA = { lat: -33.48, lng: -61.5 };

describe('API de zonas (integración)', () => {
  let prueba: AppDePrueba;
  let zonaId: string;

  const get = (url: string) => prueba.app.inject({ method: 'GET', url });
  const cotizar = (payload: object, municipio = 'firmat') =>
    prueba.app.inject({ method: 'POST', url: `/v1/municipios/${municipio}/cotizaciones`, payload });

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    await sembrar(prueba.conexion.db);
    // Sembrar dos veces no duplica datos.
    await sembrar(prueba.conexion.db);
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  it('informa salud con la base de datos conectada', async () => {
    const respuesta = await get('/salud');
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      status: 'ok',
      info: { baseDeDatos: { status: 'up' } },
    });
  });

  it('lista las zonas del municipio como GeoJSON', async () => {
    const respuesta = await get('/v1/municipios/firmat/zonas');
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<{
      type: string;
      features: { id: string; geometry: { type: string }; properties: { nombre: string } }[];
    }>();
    expect(cuerpo.type).toBe('FeatureCollection');
    expect(cuerpo.features).toHaveLength(1);
    expect(cuerpo.features[0]).toMatchObject({
      geometry: { type: 'MultiPolygon' },
      properties: { nombre: 'Microcentro' },
    });
    zonaId = cuerpo.features[0]?.id ?? '';
  });

  it('ubica un punto dentro de la zona', async () => {
    const respuesta = await get(
      `/v1/municipios/firmat/zonas/ubicar?lat=${DENTRO.lat}&lng=${DENTRO.lng}`,
    );
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({ id: zonaId, nombre: 'Microcentro' });
    expect(typeof respuesta.json<{ enHorarioDeCobro: unknown }>().enHorarioDeCobro).toBe('boolean');
  });

  it('responde 404 FUERA_DE_ZONA para un punto fuera', async () => {
    const respuesta = await get(
      `/v1/municipios/firmat/zonas/ubicar?lat=${FUERA.lat}&lng=${FUERA.lng}`,
    );
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toMatchObject({ codigo: 'FUERA_DE_ZONA' });
  });

  it('valida los parámetros con mensajes en español', async () => {
    const respuesta = await get('/v1/municipios/firmat/zonas/ubicar?lat=abc&lng=-61.5');
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({
      codigo: 'VALIDACION',
      detalles: [{ campo: 'lat', mensaje: expect.stringMatching(/se esperaba/i) as unknown }],
    });
  });

  it('expone los datos públicos del municipio', async () => {
    const respuesta = await get('/v1/municipios/firmat');
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      slug: 'firmat',
      nombre: 'Firmat',
      provincia: 'Santa Fe',
      zonaHoraria: 'America/Argentina/Buenos_Aires',
    });
  });

  it('responde 404 para un municipio inexistente', async () => {
    const respuesta = await get('/v1/municipios/rosario/zonas');
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toMatchObject({ codigo: 'MUNICIPIO_NO_ENCONTRADO' });
  });

  it('cotiza un estacionamiento con la tarifa de la zona', async () => {
    const respuesta = await cotizar({
      zonaId,
      inicio: '2026-10-05T10:00:00-03:00',
      fin: '2026-10-05T11:01:00-03:00',
    });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      zonaId,
      importe: 137_500,
      importeFormateado: expect.stringMatching(/1\.375,00/) as unknown,
      minutosCobrables: 61,
    });
  });

  it('no cotiza zonas de otro municipio', async () => {
    const respuesta = await cotizar(
      { zonaId, inicio: '2026-10-05T10:00:00-03:00', fin: '2026-10-05T11:00:00-03:00' },
      'rosario',
    );
    expect(respuesta.statusCode).toBe(404);
  });

  it('traduce los errores de dominio a 422 con su código', async () => {
    const respuesta = await cotizar({
      zonaId,
      inicio: '2026-10-05T11:00:00-03:00',
      fin: '2026-10-05T10:00:00-03:00',
    });
    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toMatchObject({ codigo: 'PERIODO_INVALIDO' });
  });

  it('rechaza fechas sin zona horaria', async () => {
    const respuesta = await cotizar({
      zonaId,
      inicio: '2026-10-05T10:00',
      fin: '2026-10-05T11:00',
    });
    expect(respuesta.statusCode).toBe(400);
  });

  it('publica la especificación OpenAPI', async () => {
    const respuesta = await get('/docs/openapi.json');
    expect(respuesta.statusCode).toBe(200);
    expect(Object.keys(respuesta.json<{ paths: object }>().paths)).toContain(
      '/v1/municipios/{municipio}/cotizaciones',
    );
  });
});
