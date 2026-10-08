import type { Mapa, UbicacionEnCuadra } from '@parkia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sembrar } from '../../src/db/sembrar.js';
import { crearAppDePrueba, cuadraDeDemo, puntoEnCuadra, type AppDePrueba } from './app.js';

const FUERA = { lat: -33.48, lng: -61.5 };

describe('API de zonas y cuadras (integración)', () => {
  let prueba: AppDePrueba;
  let sarmiento: Awaited<ReturnType<typeof cuadraDeDemo>>;
  let mapa: Mapa;
  let zonaId: string;

  const get = (url: string) => prueba.app.inject({ method: 'GET', url });
  const ubicar = ({ lat, lng }: { lat: number; lng: number }) =>
    get(`/v1/municipios/firmat/ubicar?lat=${lat}&lng=${lng}`);
  const cotizar = (payload: object, municipio = 'firmat') =>
    prueba.app.inject({ method: 'POST', url: `/v1/municipios/${municipio}/cotizaciones`, payload });

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    await sembrar(prueba.conexion.db);
    // Sembrar dos veces no duplica datos.
    await sembrar(prueba.conexion.db);
    sarmiento = await cuadraDeDemo(prueba.conexion, 'Sarmiento', 700);
    mapa = (await get('/v1/municipios/firmat/mapa')).json<Mapa>();
    zonaId = mapa.zonas.find((z) => z.nombre === 'Microcentro')?.id ?? '';
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

  describe('mapa', () => {
    it('incluye las zonas con su tarifa y horario', () => {
      expect(mapa.zonas.map((z) => z.nombre)).toEqual(['La Quemada', 'Microcentro']);
      expect(mapa.zonas.find((z) => z.id === zonaId)).toMatchObject({
        color: '#2754E6',
        tarifa: { precioHora: 100_000, horario: 'Lun a Vie 8 a 20 · Sáb 8 a 13' },
      });
    });

    it('dibuja cada cuadra como una línea con capacidad y ocupación por mano', () => {
      const { features } = mapa.cuadras;
      expect(features).toHaveLength(30);
      expect(features.every((f) => f.geometry.coordinates.length >= 2)).toBe(true);
      expect(features.find((f) => f.id === sarmiento.id)).toMatchObject({
        properties: {
          zonaId,
          calle: 'Sarmiento',
          alturaDesde: 700,
          alturaHasta: 799,
          lugaresNumerados: false,
          ocupados: { par: 0, impar: 0 },
          color: '#2754E6',
        },
      });
    });

    it('una manzana triangular aporta sus 3 cuadras a la zona', () => {
      const quemada = mapa.zonas.find((z) => z.nombre === 'La Quemada')?.id;
      const calles = new Set(
        mapa.cuadras.features
          .filter((f) => f.properties.zonaId === quemada)
          .map((f) => f.properties.calle),
      );
      expect(calles.size).toBeGreaterThanOrEqual(3);
    });

    it('responde 404 para un municipio inexistente', async () => {
      const respuesta = await get('/v1/municipios/rosario/mapa');
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json()).toMatchObject({ codigo: 'MUNICIPIO_NO_ENCONTRADO' });
    });
  });

  describe('ubicar', () => {
    it('detecta la cuadra, la mano par y la altura', async () => {
      const respuesta = await ubicar(puntoEnCuadra(sarmiento, 0.5, 6));
      expect(respuesta.statusCode).toBe(200);
      const ubicacion = respuesta.json<UbicacionEnCuadra>();
      expect(ubicacion).toMatchObject({
        cuadra: { id: sarmiento.id, calle: 'Sarmiento' },
        zona: { id: zonaId },
        lado: 'par',
        lugaresOcupados: [],
      });
      expect(ubicacion.altura % 2).toBe(0);
      expect(Math.abs(ubicacion.altura - 750)).toBeLessThanOrEqual(2);
      expect(ubicacion.direccion).toBe(`Sarmiento ${String(ubicacion.altura)}`);
      expect(ubicacion.distanciaMetros).toBeLessThan(8);
    });

    it('del otro lado de la calle detecta la mano impar', async () => {
      const ubicacion = (await ubicar(puntoEnCuadra(sarmiento, 0.2, -6))).json<UbicacionEnCuadra>();
      expect(ubicacion.lado).toBe('impar');
      expect(ubicacion.altura % 2).toBe(1);
      expect(ubicacion.altura).toBeLessThan(750);
    });

    it('responde 404 FUERA_DE_ZONA lejos de las cuadras tarifadas', async () => {
      const respuesta = await ubicar(FUERA);
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json()).toMatchObject({ codigo: 'FUERA_DE_ZONA' });
    });

    it('valida los parámetros con mensajes en español', async () => {
      const respuesta = await get('/v1/municipios/firmat/ubicar?lat=abc&lng=-61.5');
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toMatchObject({
        codigo: 'VALIDACION',
        detalles: [{ campo: 'lat', mensaje: expect.stringMatching(/se esperaba/i) as unknown }],
      });
    });
  });

  describe('cotizaciones', () => {
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
  });

  it('publica la especificación OpenAPI', async () => {
    const respuesta = await get('/docs/openapi.json');
    expect(respuesta.statusCode).toBe(200);
    expect(Object.keys(respuesta.json<{ paths: object }>().paths)).toEqual(
      expect.arrayContaining([
        '/v1/municipios/{municipio}/mapa',
        '/v1/municipios/{municipio}/ubicar',
        '/v1/municipios/{municipio}/cotizaciones',
      ]),
    );
  });
});
