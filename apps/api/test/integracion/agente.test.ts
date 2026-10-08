import type { Control, Jornada, Padron, Radar } from '@parkia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { crearPersonal } from '../../src/db/crear-personal.js';
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

/** Hora local de Argentina. El lunes 5/10/2026 se cobra de 8 a 20. */
const ar = (fechaHora: string) => new Date(`${fechaHora}-03:00`);

const FUERA = { lat: -33.48, lng: -61.5 };

type Cuadra = Awaited<ReturnType<typeof cuadraDeDemo>>;

describe('Ronda del agente (integración)', () => {
  const reloj = new RelojDePrueba(ar('2026-10-05T10:00'));
  let prueba: AppDePrueba;
  let agente: string;
  let conductores: Record<'a' | 'b' | 'c', string>;
  let sarmiento: Cuadra;
  let sarmiento800: Cuadra;
  let santaFe: Cuadra;

  const base = '/v1/municipios/firmat';
  const pedir = (method: 'GET' | 'POST', url: string, token: string, payload?: object) =>
    prueba.app.inject({ method, url, headers: conToken(token), ...(payload && { payload }) });
  const controlar = async (patente: string, donde: object) =>
    (await pedir('POST', `${base}/controles`, agente, { patente, ...donde })).json<Control>();
  const padron = async (cuadra: Cuadra) =>
    (await pedir('GET', `${base}/agente/cuadras/${cuadra.id}/padron`, agente)).json<Padron>();
  const radar = async (cerca = puntoEnCuadra(sarmiento, 0.5, 0)) =>
    (
      await pedir('GET', `${base}/agente/radar?lat=${cerca.lat}&lng=${cerca.lng}`, agente)
    ).json<Radar>();

  async function estacionar(token: string, patente: string, saldo: number, donde: object) {
    await pedir('POST', '/v1/vehiculos', token, { patente });
    await pedir('POST', `${base}/billetera/cargas-de-prueba`, token, { importe: saldo });
    const respuesta = await pedir('POST', `${base}/estacionamientos`, token, { patente, ...donde });
    expect(respuesta.statusCode).toBe(201);
    return respuesta.json<{ id: string }>().id;
  }

  beforeAll(async () => {
    prueba = await crearAppDePrueba({ reloj });
    await sembrar(prueba.conexion.db);
    await crearPersonal(prueba.conexion.db, {
      email: 'ronda@firmat.gob.ar',
      municipio: 'firmat',
      rol: 'agente',
      contrasena: 'contrasena-de-la-ronda',
    });
    agente = await sesionDePersonal(prueba, 'ronda@firmat.gob.ar', 'contrasena-de-la-ronda');
    conductores = {
      a: await sesionDeConductor(prueba, 'ronda-a@ejemplo.com'),
      b: await sesionDeConductor(prueba, 'ronda-b@ejemplo.com'),
      c: await sesionDeConductor(prueba, 'ronda-c@ejemplo.com'),
    };
    sarmiento = await cuadraDeDemo(prueba.conexion, 'Sarmiento', 700);
    sarmiento800 = await cuadraDeDemo(prueba.conexion, 'Sarmiento', 800);
    santaFe = await cuadraDeDemo(prueba.conexion, 'Avenida Santa Fe', 600);

    // $500 cubren el mínimo de 30 minutos: vencen a las 10:30.
    await estacionar(conductores.a, 'AA111AA', 50_000, {
      cuadraId: sarmiento.id,
      lado: 'par',
      altura: 750,
    });
    await estacionar(conductores.b, 'AB222BB', 500_000, { cuadraId: sarmiento.id, lado: 'impar' });
    await estacionar(conductores.c, 'AC333CC', 50_000, {
      cuadraId: santaFe.id,
      lado: 'impar',
      lugar: 3,
    });
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  describe('padrón de la cuadra', () => {
    it('lista por mano los vehículos declarados', async () => {
      const { cuadra, manos, ultimoControl } = await padron(sarmiento);
      expect(cuadra).toMatchObject({ calle: 'Sarmiento', ocupados: { par: 1, impar: 1 } });
      expect(manos.par).toMatchObject({
        capacidad: 18,
        vehiculos: [{ patente: 'AA111AA', altura: 750, situacion: 'vigente', controladoEn: null }],
      });
      expect(manos.impar.vehiculos.map((v) => v.patente)).toEqual(['AB222BB']);
      expect(ultimoControl).toBeNull();
    });

    it('en cuadras numeradas informa el lugar', async () => {
      const { manos } = await padron(santaFe);
      expect(manos.impar.vehiculos).toMatchObject([{ patente: 'AC333CC', lugar: 3 }]);
    });

    it('solo el personal con rol agente lo puede ver', async () => {
      const respuesta = await pedir(
        'GET',
        `${base}/agente/cuadras/${sarmiento.id}/padron`,
        conductores.a,
      );
      expect(respuesta.statusCode).toBe(403);
    });
  });

  describe('control', () => {
    it('confirma que el vehículo está donde declaró', async () => {
      const control = await controlar('AA111AA', puntoEnCuadra(sarmiento, 0.5, 6));
      expect(control).toMatchObject({
        resultado: 'habilitado',
        cuadra: { id: sarmiento.id },
        estacionamiento: {
          estado: 'vigente',
          coincidencia: 'misma_cuadra',
          ubicacion: { direccion: 'Sarmiento 750 · mano par' },
        },
        controlAnterior: null,
      });
    });

    it('avisa si la patente ya se controló hace poco', async () => {
      const control = await controlar('AA111AA', puntoEnCuadra(sarmiento, 0.5, 6));
      expect(control.controlAnterior).toMatchObject({ resultado: 'habilitado' });
    });

    it('el padrón registra el control', async () => {
      const { manos, ultimoControl } = await padron(sarmiento);
      expect(manos.par.vehiculos[0]?.controladoEn).toBe(ar('2026-10-05T10:00').toISOString());
      expect(ultimoControl).not.toBeNull();
    });

    it('distingue una cuadra vecina de una lejana', async () => {
      const esquina = await controlar('AB222BB', puntoEnCuadra(sarmiento800, 0.2, 6));
      expect(esquina.cuadra?.id).toBe(sarmiento800.id);
      expect(esquina.estacionamiento?.coincidencia).toBe('cuadra_cercana');

      const lejos = await controlar('AB222BB', puntoEnCuadra(sarmiento800, 0.85, 6));
      expect(lejos).toMatchObject({
        resultado: 'habilitado',
        estacionamiento: { coincidencia: 'otra_cuadra' },
      });
    });

    it('el agente puede elegir la cuadra si el GPS falla', async () => {
      const control = await controlar('AA111AA', { ...FUERA, cuadraId: sarmiento.id });
      expect(control).toMatchObject({ resultado: 'habilitado', cuadra: { id: sarmiento.id } });
    });
  });

  describe('radar', () => {
    it('anticipa los que están por vencer', async () => {
      reloj.fijar(ar('2026-10-05T10:25'));
      const { porVencer, vencidos } = await radar();
      expect(porVencer.map((aviso) => aviso.patente).sort()).toEqual(['AA111AA', 'AC333CC']);
      expect(vencidos).toEqual([]);
    });

    it('sigue mostrando los vencidos después del cierre automático', async () => {
      reloj.fijar(ar('2026-10-05T10:40'));
      expect(await prueba.app.get(EstacionamientosService).cerrarVencidos()).toBe(2);

      const { vencidos } = await radar();
      // Los más cercanos al agente (en Sarmiento) primero.
      expect(vencidos.map((aviso) => aviso.patente)).toEqual(['AA111AA', 'AC333CC']);
      expect(vencidos[0]).toMatchObject({
        situacion: 'vencido',
        ubicacion: { direccion: 'Sarmiento 750 · mano par' },
        zona: { nombre: 'Microcentro' },
        venceEn: ar('2026-10-05T10:30').toISOString(),
      });
      expect(vencidos[0]?.distanciaMetros).toBeLessThan(15);
    });

    it('el control de un vencido lo informa y lo manda al final del radar', async () => {
      const control = await controlar('AA111AA', puntoEnCuadra(sarmiento, 0.5, 6));
      expect(control).toMatchObject({
        resultado: 'vencido',
        habilitado: false,
        estacionamiento: { estado: 'vencido', venceEn: ar('2026-10-05T10:30').toISOString() },
      });
      const { vencidos } = await radar();
      expect(vencidos.map((aviso) => aviso.patente)).toEqual(['AC333CC', 'AA111AA']);
    });

    it('el padrón conserva al vencido pero no lo cuenta como ocupado', async () => {
      const { cuadra, manos } = await padron(sarmiento);
      expect(cuadra.ocupados.par).toBe(0);
      expect(manos.par.vehiculos).toMatchObject([{ patente: 'AA111AA', situacion: 'vencido' }]);
    });

    it('si vuelve a estacionar, deja de figurar como vencido', async () => {
      await pedir('POST', `${base}/billetera/cargas-de-prueba`, conductores.a, {
        importe: 100_000,
      });
      await pedir('POST', `${base}/estacionamientos`, conductores.a, {
        patente: 'AA111AA',
        cuadraId: sarmiento.id,
        lado: 'par',
      });
      const { vencidos } = await radar();
      expect(vencidos.map((aviso) => aviso.patente)).toEqual(['AC333CC']);
      expect((await controlar('AA111AA', puntoEnCuadra(sarmiento, 0.5, 6))).resultado).toBe(
        'habilitado',
      );
    });

    it('pasadas 2 horas el vencido sale del radar, pero el control lo sigue informando', async () => {
      reloj.fijar(ar('2026-10-05T12:31'));
      expect((await radar()).vencidos.map((aviso) => aviso.patente)).not.toContain('AC333CC');
      const control = await controlar('AC333CC', puntoEnCuadra(santaFe, 0.3, -6));
      expect(control).toMatchObject({
        resultado: 'vencido',
        estacionamiento: { ubicacion: { lugar: 3 }, coincidencia: 'misma_cuadra' },
      });
    });

    it('si el conductor finalizó, ya no tiene cobertura', async () => {
      const [enCurso] = (
        await pedir('GET', `${base}/estacionamientos?limite=1`, conductores.b)
      ).json<{ id: string }[]>();
      await pedir('POST', `${base}/estacionamientos/${enCurso?.id ?? ''}/finalizar`, conductores.b);
      const control = await controlar('AB222BB', puntoEnCuadra(sarmiento, 0.5, -6));
      expect(control).toMatchObject({ resultado: 'sin_estacionamiento', estacionamiento: null });
    });
  });

  it('la jornada resume los controles del agente y la cobertura del equipo', async () => {
    const respuesta = await pedir('GET', `${base}/agente/jornada`, agente);
    expect(respuesta.statusCode).toBe(200);
    const jornada = respuesta.json<Jornada>();
    expect(jornada).toMatchObject({
      desde: ar('2026-10-05T00:00').toISOString(),
      controles: 9,
      infracciones: 3,
      porResultado: { habilitado: 6, vencido: 2, sin_estacionamiento: 1 },
    });
    expect(jornada.ultimos[0]).toMatchObject({
      patente: 'AB222BB',
      resultado: 'sin_estacionamiento',
      habilitado: false,
      calle: 'Sarmiento',
    });
    expect(jornada.cobertura.map((c) => c.cuadraId).sort()).toEqual(
      [sarmiento.id, sarmiento800.id, santaFe.id].sort(),
    );
  });
});
