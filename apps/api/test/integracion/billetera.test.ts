import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BilleteraService } from '../../src/billetera/billetera.service.js';
import { MAX_VEHICULOS } from '../../src/billetera/vehiculos.controller.js';
import { municipios } from '../../src/db/esquema.js';
import { sembrar } from '../../src/db/sembrar.js';
import { conToken, crearAppDePrueba, sesionDeConductor, type AppDePrueba } from './app.js';

describe('Vehículos y billetera (integración)', () => {
  let prueba: AppDePrueba;
  let token: string;

  const pedir = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object, t = token) =>
    prueba.app.inject({ method, url, headers: conToken(t), ...(payload && { payload }) });

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    await sembrar(prueba.conexion.db);
    token = await sesionDeConductor(prueba, 'billetera@ejemplo.com');
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  describe('vehículos', () => {
    it('agrega un vehículo normalizando la patente', async () => {
      const respuesta = await pedir('POST', '/v1/vehiculos', {
        patente: 'ab 123 cd',
        alias: 'Auto',
      });
      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json()).toMatchObject({ patente: 'AB123CD', alias: 'Auto' });
    });

    it('rechaza patentes inválidas con mensaje claro', async () => {
      const respuesta = await pedir('POST', '/v1/vehiculos', { patente: 'XYZ' });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toMatchObject({ detalles: [{ campo: 'patente' }] });
    });

    it('no duplica una patente en la misma cuenta', async () => {
      const respuesta = await pedir('POST', '/v1/vehiculos', { patente: 'AB-123-CD' });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toMatchObject({ codigo: 'VEHICULO_DUPLICADO' });
    });

    it('lista solo los vehículos propios y permite quitarlos', async () => {
      const otro = await sesionDeConductor(prueba, 'otro@ejemplo.com');
      const ajeno = await pedir('POST', '/v1/vehiculos', { patente: 'ABC123' }, otro);
      const idAjeno = ajeno.json<{ id: string }>().id;

      const lista = await pedir('GET', '/v1/vehiculos');
      expect(lista.json<{ patente: string }[]>().map((v) => v.patente)).toEqual(['AB123CD']);

      expect((await pedir('DELETE', `/v1/vehiculos/${idAjeno}`)).statusCode).toBe(404);
      expect((await pedir('DELETE', `/v1/vehiculos/${idAjeno}`, undefined, otro)).statusCode).toBe(
        204,
      );
    });

    it(`limita a ${MAX_VEHICULOS} vehículos por cuenta`, async () => {
      const flota = await sesionDeConductor(prueba, 'flota@ejemplo.com');
      for (let i = 0; i < MAX_VEHICULOS; i++) {
        const patente = `AA${String(100 + i)}BB`;
        expect((await pedir('POST', '/v1/vehiculos', { patente }, flota)).statusCode).toBe(201);
      }
      const excedido = await pedir('POST', '/v1/vehiculos', { patente: 'AA999ZZ' }, flota);
      expect(excedido.statusCode).toBe(409);
      expect(excedido.json()).toMatchObject({ codigo: 'LIMITE_DE_VEHICULOS' });
    });
  });

  describe('billetera', () => {
    const url = '/v1/municipios/firmat/billetera';

    it('arranca en cero', async () => {
      const respuesta = await pedir('GET', url);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({ municipio: 'firmat', saldo: 0, movimientos: [] });
    });

    it('acredita una carga de prueba y la registra en el libro', async () => {
      const respuesta = await pedir('POST', `${url}/cargas-de-prueba`, { importe: 500_000 });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({
        saldo: 500_000,
        saldoFormateado: expect.stringMatching(/5\.000,00/) as unknown,
        movimientos: [{ tipo: 'carga', importe: 500_000, saldoResultante: 500_000 }],
      });
    });

    it('serializa cargas simultáneas sin perder ninguna', async () => {
      const usuario = await sesionDeConductor(prueba, 'concurrente@ejemplo.com');
      await Promise.all(
        Array.from({ length: 10 }, () =>
          pedir('POST', `${url}/cargas-de-prueba`, { importe: 10_000 }, usuario),
        ),
      );
      const respuesta = await pedir('GET', url, undefined, usuario);
      expect(respuesta.json()).toMatchObject({ saldo: 100_000 });
      expect(respuesta.json<{ movimientos: unknown[] }>().movimientos).toHaveLength(10);
    });

    it('nunca deja el saldo negativo', async () => {
      const servicio = prueba.app.get(BilleteraService);
      const [firmat] = await prueba.conexion.db
        .select({ id: municipios.id })
        .from(municipios)
        .where(sql`${municipios.slug} = 'firmat'`);
      const usuarioId = (await pedir('GET', '/v1/auth/yo')).json<{ id: string }>().id;

      await expect(
        prueba.conexion.db.transaction(async (tx) => {
          const billetera = await servicio.bloquear(tx, usuarioId, firmat?.id ?? '');
          await servicio.registrar(tx, billetera, {
            tipo: 'consumo',
            importe: -(billetera.saldo + 1),
            referencia: 'prueba-saldo-negativo',
            descripcion: 'No debería registrarse',
          });
        }),
      ).rejects.toMatchObject({ codigo: 'SALDO_INSUFICIENTE' });
    });

    it('el libro de movimientos no admite modificaciones ni borrados', async () => {
      await expect(
        prueba.conexion.db.execute(sql`update movimientos set importe = 1`),
      ).rejects.toThrow();
      await expect(prueba.conexion.db.execute(sql`delete from movimientos`)).rejects.toThrow();
      await expect(prueba.conexion.db.execute(sql`truncate movimientos`)).rejects.toThrow();
    });

    it('valida el importe de la carga', async () => {
      for (const importe of [0, -100, 1.5, 100_000_000]) {
        expect((await pedir('POST', `${url}/cargas-de-prueba`, { importe })).statusCode).toBe(400);
      }
    });

    it('exige sesión', async () => {
      const respuesta = await prueba.app.inject({ method: 'GET', url });
      expect(respuesta.statusCode).toBe(401);
    });
  });
});
