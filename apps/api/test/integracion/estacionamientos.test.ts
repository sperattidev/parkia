import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { crearPersonal } from '../../src/db/crear-personal.js';
import { zonas } from '../../src/db/esquema.js';
import { sembrar } from '../../src/db/sembrar.js';
import { EstacionamientosService } from '../../src/estacionamientos/estacionamientos.service.js';
import {
  RelojDePrueba,
  conToken,
  crearAppDePrueba,
  cuadraDeDemo,
  puntoEnCuadra,
  sesionDeConductor,
  sesionDePersonal,
  type AppDePrueba,
} from './app.js';

/** Hora local de Argentina. Lunes 5/10/2026 es día hábil; domingo 11/10, no se cobra. */
const ar = (fechaHora: string) => new Date(`${fechaHora}-03:00`);

const FUERA = { lat: -33.48, lng: -61.5 };

interface EstacionamientoDto {
  id: string;
  estado: string;
  venceEn: string;
  fin: string | null;
  importe: number;
}

describe('Estacionamientos y control (integración)', () => {
  const reloj = new RelojDePrueba(ar('2026-10-05T10:00'));
  let prueba: AppDePrueba;
  let conductor: string;
  let agente: string;
  let zonaId: string;
  let sarmiento: Awaited<ReturnType<typeof cuadraDeDemo>>;
  let santaFe: Awaited<ReturnType<typeof cuadraDeDemo>>;
  /** Frente a Sarmiento 750, mano par. */
  let dentro: { lat: number; lng: number };

  const base = '/v1/municipios/firmat';
  const pedir = (method: 'GET' | 'POST', url: string, token: string, payload?: object) =>
    prueba.app.inject({ method, url, headers: conToken(token), ...(payload && { payload }) });
  const cargar = (importe: number, token = conductor) =>
    pedir('POST', `${base}/billetera/cargas-de-prueba`, token, { importe });
  const iniciar = (patente = 'AB123CD', token = conductor, donde: object = {}) =>
    pedir('POST', `${base}/estacionamientos`, token, {
      cuadraId: sarmiento.id,
      lado: 'par',
      patente,
      ...donde,
    });
  const controlar = (patente: string, ubicacion = dentro) =>
    pedir('POST', `${base}/controles`, agente, { patente, ...ubicacion });
  const saldo = async () =>
    (await pedir('GET', `${base}/billetera`, conductor)).json<{ saldo: number }>().saldo;

  beforeAll(async () => {
    prueba = await crearAppDePrueba({ reloj });
    await sembrar(prueba.conexion.db);
    await crearPersonal(prueba.conexion.db, {
      email: 'inspector@firmat.gob.ar',
      municipio: 'firmat',
      rol: 'agente',
      contrasena: 'contrasena-del-inspector',
    });
    agente = await sesionDePersonal(prueba, 'inspector@firmat.gob.ar', 'contrasena-del-inspector');
    conductor = await sesionDeConductor(prueba, 'conductora@ejemplo.com');
    sarmiento = await cuadraDeDemo(prueba.conexion, 'Sarmiento', 700);
    santaFe = await cuadraDeDemo(prueba.conexion, 'Avenida Santa Fe', 600);
    dentro = puntoEnCuadra(sarmiento, 0.5, 6);
    const mapa = await prueba.app.inject({ method: 'GET', url: `${base}/mapa` });
    const microcentro = mapa
      .json<{ zonas: { id: string; nombre: string }[] }>()
      .zonas.find((z) => z.nombre === 'Microcentro');
    if (!microcentro) throw new Error('La semilla no creó la zona del microcentro.');
    zonaId = microcentro.id;
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  describe('inicio', () => {
    it('exige que la patente esté en la cuenta', async () => {
      const respuesta = await iniciar();
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ codigo: 'VEHICULO_NO_REGISTRADO' });
    });

    it('exige saldo para el mínimo cuando se está cobrando', async () => {
      await pedir('POST', '/v1/vehiculos', conductor, { patente: 'AB123CD' });
      const respuesta = await iniciar();
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ codigo: 'SALDO_INSUFICIENTE' });
    });

    it('inicia y calcula hasta cuándo cubre el saldo', async () => {
      await cargar(50_000); // $500: cubre el mínimo de 30 minutos
      const respuesta = await iniciar();
      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json()).toMatchObject({
        estado: 'activo',
        patente: 'AB123CD',
        zona: { nombre: 'Microcentro' },
        ubicacion: {
          cuadraId: sarmiento.id,
          calle: 'Sarmiento',
          altura: 750,
          lado: 'par',
          lugar: null,
          direccion: 'Sarmiento 750 · mano par',
        },
        venceEn: ar('2026-10-05T10:30').toISOString(),
        importe: 0,
      });
    });

    it('no permite dos estacionamientos en curso con la misma billetera', async () => {
      await pedir('POST', '/v1/vehiculos', conductor, { patente: 'AC456DE' });
      const respuesta = await iniciar('AC456DE');
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toMatchObject({ codigo: 'ESTACIONAMIENTO_EN_CURSO' });
    });

    it('no permite estacionar dos veces la misma patente', async () => {
      const otra = await sesionDeConductor(prueba, 'familiar@ejemplo.com');
      await pedir('POST', '/v1/vehiculos', otra, { patente: 'AB123CD' });
      await cargar(50_000, otra);
      const respuesta = await iniciar('AB123CD', otra);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toMatchObject({ codigo: 'PATENTE_YA_ESTACIONADA' });
    });
  });

  describe('ubicación en la cuadra', () => {
    let conLugar: string;

    beforeAll(async () => {
      conLugar = await sesionDeConductor(prueba, 'avenida@ejemplo.com');
      await pedir('POST', '/v1/vehiculos', conLugar, { patente: 'AD789EF' });
      await cargar(50_000, conLugar);
    });

    const enAvenida = (donde: object, token = conLugar, patente = 'AD789EF') =>
      iniciar(patente, token, { cuadraId: santaFe.id, ...donde });

    it('rechaza una altura que no corresponde a la mano', async () => {
      const respuesta = await iniciar('AD789EF', conLugar, { altura: 751 });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ codigo: 'ALTURA_DE_OTRA_MANO' });
    });

    it('rechaza una altura fuera de la cuadra', async () => {
      const respuesta = await iniciar('AD789EF', conLugar, { altura: 820 });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ codigo: 'ALTURA_FUERA_DE_CUADRA' });
    });

    it('no acepta lugar en cuadras sin lugares numerados', async () => {
      const respuesta = await iniciar('AD789EF', conLugar, { lugar: 3 });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ codigo: 'SIN_LUGARES_NUMERADOS' });
    });

    it('en cuadras numeradas exige elegir un lugar válido', async () => {
      const sinLugar = await enAvenida({ lado: 'impar' });
      expect(sinLugar.json()).toMatchObject({ codigo: 'LUGAR_REQUERIDO' });
      const inexistente = await enAvenida({ lado: 'impar', lugar: 19 });
      expect(inexistente.json()).toMatchObject({ codigo: 'LUGAR_INVALIDO' });
    });

    it('registra calle, altura y lugar elegidos', async () => {
      const respuesta = await enAvenida({ lado: 'impar', altura: 635, lugar: 7 });
      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json()).toMatchObject({
        ubicacion: {
          lado: 'impar',
          altura: 635,
          lugar: 7,
          direccion: 'Avenida Santa Fe 635 · mano impar · lugar 7',
        },
      });
    });

    it('ubicar informa los lugares ocupados de la mano', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${base}/ubicar?lat=${String(puntoEnCuadra(santaFe, 0.4, -6).lat)}&lng=${String(puntoEnCuadra(santaFe, 0.4, -6).lng)}`,
      });
      expect(respuesta.json()).toMatchObject({ lado: 'impar', lugaresOcupados: [7] });
    });

    it('informa capacidad y lugares ocupados de cada mano', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${base}/cuadras/${santaFe.id}/lugares?lado=impar`,
      });
      expect(respuesta.json()).toEqual({
        cuadraId: santaFe.id,
        lado: 'impar',
        capacidad: 18,
        ocupados: [7],
      });
    });

    it('un lugar numerado no se puede ocupar dos veces', async () => {
      const otra = await sesionDeConductor(prueba, 'vecina@ejemplo.com');
      await pedir('POST', '/v1/vehiculos', otra, { patente: 'AE111AA' });
      await cargar(50_000, otra);
      const respuesta = await enAvenida({ lado: 'impar', lugar: 7 }, otra, 'AE111AA');
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toMatchObject({ codigo: 'LUGAR_OCUPADO' });
      const libre = await enAvenida({ lado: 'impar', lugar: 8 }, otra, 'AE111AA');
      expect(libre.statusCode).toBe(201);

      // Liberan la cuadra para no interferir con el resto de la suite.
      const enCurso = [
        [
          conLugar,
          (
            await pedir('GET', `${base}/estacionamientos/activo`, conLugar)
          ).json<EstacionamientoDto>().id,
        ],
        [otra, libre.json<EstacionamientoDto>().id],
      ] as const;
      for (const [token, id] of enCurso) {
        await pedir('POST', `${base}/estacionamientos/${id}/finalizar`, token);
      }
    });
  });

  describe('durante el estacionamiento', () => {
    it('el agente lo ve habilitado', async () => {
      const respuesta = await controlar('ab-123-cd');
      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json()).toMatchObject({
        patente: 'AB123CD',
        resultado: 'habilitado',
        habilitado: true,
        zona: { nombre: 'Microcentro' },
        cuadra: { id: sarmiento.id, calle: 'Sarmiento', alturaDesde: 700, alturaHasta: 799 },
        estacionamiento: {
          venceEn: ar('2026-10-05T10:30').toISOString(),
          ubicacion: { direccion: 'Sarmiento 750 · mano par' },
        },
      });
    });

    it('solo el personal con rol agente puede controlar', async () => {
      const respuesta = await pedir('POST', `${base}/controles`, conductor, {
        patente: 'AB123CD',
        ...dentro,
      });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json()).toMatchObject({ codigo: 'SIN_PERMISO' });
    });

    it('el mapa cuenta la ocupación de la mano', async () => {
      const mapa = await prueba.app.inject({ method: 'GET', url: `${base}/mapa` });
      const cuadra = mapa
        .json<{ cuadras: { features: { id: string; properties: { ocupados: object } }[] } }>()
        .cuadras.features.find((f) => f.id === sarmiento.id);
      expect(cuadra?.properties.ocupados).toEqual({ par: 1, impar: 0 });
    });

    it('muestra el importe acumulado', async () => {
      reloj.fijar(ar('2026-10-05T10:20'));
      const respuesta = await pedir('GET', `${base}/estacionamientos/activo`, conductor);
      expect(respuesta.json()).toMatchObject({ estado: 'activo', importe: 50_000 });
    });

    it('cargar saldo extiende el vencimiento', async () => {
      await cargar(25_000); // total $750: cubre 45 minutos
      const respuesta = await pedir('GET', `${base}/estacionamientos/activo`, conductor);
      expect(respuesta.json()).toMatchObject({ venceEn: ar('2026-10-05T10:45').toISOString() });
    });
  });

  describe('vencimiento', () => {
    it('pasado el vencimiento el agente lo ve vencido', async () => {
      reloj.fijar(ar('2026-10-05T10:50'));
      expect((await controlar('AB123CD')).json()).toMatchObject({
        resultado: 'vencido',
        habilitado: false,
      });
    });

    it('el cierre automático cobra hasta el vencimiento', async () => {
      const servicio = prueba.app.get(EstacionamientosService);
      expect(await servicio.cerrarVencidos()).toBe(1);
      expect(await servicio.cerrarVencidos()).toBe(0);

      const [cerrado] = (await pedir('GET', `${base}/estacionamientos`, conductor)).json<
        EstacionamientoDto[]
      >();
      expect(cerrado).toMatchObject({
        estado: 'finalizado',
        fin: ar('2026-10-05T10:45').toISOString(),
        importe: 75_000,
      });
      expect(await saldo()).toBe(0);
      expect((await pedir('GET', `${base}/estacionamientos/activo`, conductor)).json()).toBeNull();
    });

    it('un vehículo sin estacionamiento figura como tal', async () => {
      expect((await controlar('AB123CD')).json()).toMatchObject({
        resultado: 'sin_estacionamiento',
        habilitado: false,
        estacionamiento: null,
      });
    });
  });

  describe('finalización', () => {
    let id: string;

    it('cobra solo el tiempo usado al finalizar antes', async () => {
      await cargar(100_000);
      id = (await iniciar()).json<EstacionamientoDto>().id;
      reloj.avanzar(11);
      const respuesta = await pedir('POST', `${base}/estacionamientos/${id}/finalizar`, conductor);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({ estado: 'finalizado', importe: 50_000 });
      expect(await saldo()).toBe(50_000);
    });

    it('finalizar dos veces no cobra dos veces', async () => {
      const respuesta = await pedir('POST', `${base}/estacionamientos/${id}/finalizar`, conductor);
      expect(respuesta.json()).toMatchObject({ estado: 'finalizado', importe: 50_000 });
      expect(await saldo()).toBe(50_000);
    });

    it('no se puede finalizar el estacionamiento de otra persona', async () => {
      const otra = await sesionDeConductor(prueba, 'ajena@ejemplo.com');
      const respuesta = await pedir('POST', `${base}/estacionamientos/${id}/finalizar`, otra);
      expect(respuesta.statusCode).toBe(404);
    });

    it('cobra con la tarifa vigente al iniciar aunque cambie durante la estadía', async () => {
      const nuevo = (await iniciar()).json<EstacionamientoDto>().id;
      // El municipio duplica la tarifa a mitad del estacionamiento.
      await prueba.conexion.db
        .update(zonas)
        .set({
          reglaTarifaria: sql`jsonb_set(${zonas.reglaTarifaria}, '{tramos,0,precioHora}', '200000')`,
        })
        .where(eq(zonas.id, zonaId));
      reloj.avanzar(20);
      const respuesta = await pedir(
        'POST',
        `${base}/estacionamientos/${nuevo}/finalizar`,
        conductor,
      );
      expect(respuesta.json()).toMatchObject({ importe: 50_000 });
      await sembrar(prueba.conexion.db); // restaura la tarifa original
    });
  });

  describe('control fuera de condiciones', () => {
    it('fuera de la zona tarifada', async () => {
      expect((await controlar('AB123CD', FUERA)).json()).toMatchObject({
        resultado: 'fuera_de_zona',
        zona: null,
      });
    });

    it('fuera del horario de cobro el vehículo está habilitado', async () => {
      reloj.fijar(ar('2026-10-11T12:00'));
      expect((await controlar('ZZ999ZZ')).json()).toMatchObject({
        resultado: 'fuera_de_horario',
        habilitado: true,
      });
    });

    it('rechaza patentes inválidas', async () => {
      expect((await controlar('NO-VALE')).statusCode).toBe(400);
    });
  });
});
