import type { Padron, Radar } from '@parkia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { crearPersonal } from '../../src/db/crear-personal.js';
import { sembrar } from '../../src/db/sembrar.js';
import {
  DOMINIO_SIMULADO,
  SimulacionNoPermitida,
  Simulador,
} from '../../src/simulacion/simulador.js';
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

/** Hora local de Argentina. El martes 6/10/2026 se cobra de 8 a 20 en las dos zonas. */
const ar = (fechaHora: string) => new Date(`${fechaHora}-03:00`);

const SIMULADOS = `%@${DOMINIO_SIMULADO}`;

describe('Simulación de actividad (integración)', () => {
  const reloj = new RelojDePrueba(ar('2026-10-06T11:00'));
  let prueba: AppDePrueba;
  let simulador: Simulador;
  let agente: string;
  let conductorReal: string;
  let estacionamientoReal: string;

  const base = '/v1/municipios/firmat';
  const pedir = (method: 'GET' | 'POST', url: string, token: string, payload?: object) =>
    prueba.app.inject({ method, url, headers: conToken(token), ...(payload && { payload }) });
  const consultar = async <T extends object>(texto: string, valores: unknown[] = []) =>
    (await prueba.conexion.pool.query<T>(texto, valores)).rows;
  const contar = async (texto: string, valores: unknown[] = []) => {
    const [fila] = await consultar<{ total: string }>(texto, valores);
    return Number(fila?.total);
  };

  beforeAll(async () => {
    prueba = await crearAppDePrueba({ reloj });
    await sembrar(prueba.conexion.db);
    simulador = new Simulador(prueba.conexion, { PARKIA_ENTORNO: 'demo' }, () => reloj.ahora());
    await crearPersonal(prueba.conexion.db, {
      email: 'simulacion@firmat.gob.ar',
      municipio: 'firmat',
      rol: 'agente',
      contrasena: 'contrasena-de-la-simulacion',
    });
    agente = await sesionDePersonal(
      prueba,
      'simulacion@firmat.gob.ar',
      'contrasena-de-la-simulacion',
    );

    // Actividad real, que la simulación debe respetar y no tocar.
    conductorReal = await sesionDeConductor(prueba, 'real@ejemplo.com');
    const santaFe = await cuadraDeDemo(prueba.conexion, 'Avenida Santa Fe', 600);
    await pedir('POST', '/v1/vehiculos', conductorReal, { patente: 'AD444DD' });
    await pedir('POST', `${base}/billetera/cargas-de-prueba`, conductorReal, { importe: 500_000 });
    const respuesta = await pedir('POST', `${base}/estacionamientos`, conductorReal, {
      patente: 'AD444DD',
      cuadraId: santaFe.id,
      lado: 'impar',
      lugar: 1,
    });
    expect(respuesta.statusCode).toBe(201);
    estacionamientoReal = respuesta.json<{ id: string }>().id;
    await pedir('POST', `${base}/controles`, agente, {
      patente: 'AD444DD',
      ...puntoEnCuadra(santaFe, 0.5, -6),
    });
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  it('se niega a correr en producción', () => {
    expect(() => new Simulador(prueba.conexion, { PARKIA_ENTORNO: 'produccion' })).toThrow(
      SimulacionNoPermitida,
    );
  });

  describe('foto retroactiva', () => {
    beforeAll(async () => {
      const resumen = await simulador.ejecutar({
        municipio: 'firmat',
        ocupacion: 0.5,
        retroactiva: true,
        semilla: 7,
      });
      expect(resumen.iniciados).toBeGreaterThan(400);
    });

    it('respeta la capacidad de cada mano', async () => {
      const excedidas = await consultar(
        `select c.calle, c.altura_desde, e.lado, count(*) as ocupados
           from estacionamientos e join cuadras c on c.id = e.cuadra_id
          where e.estado = 'activo'
          group by c.id, e.lado
         having count(*) > case e.lado when 'par' then c.lugares_par else c.lugares_impar end`,
      );
      expect(excedidas).toEqual([]);
    });

    it('asigna lugares únicos y válidos en las cuadras numeradas', async () => {
      const lugares = await consultar<{ lugar: number | null; capacidad: number }>(
        `select e.lugar, case e.lado when 'par' then c.lugares_par else c.lugares_impar end as capacidad
           from estacionamientos e join cuadras c on c.id = e.cuadra_id
          where c.lugares_numerados and e.estado = 'activo'`,
      );
      expect(lugares.length).toBeGreaterThan(1);
      for (const { lugar, capacidad } of lugares) {
        expect(lugar).toBeGreaterThanOrEqual(1);
        expect(lugar).toBeLessThanOrEqual(capacidad);
      }
      // El lugar 1 lo tenía el conductor real: nadie más lo ocupa.
      const enElLugarUno = await consultar<{ patente: string }>(
        `select e.patente from estacionamientos e join cuadras c on c.id = e.cuadra_id
          where c.calle = 'Avenida Santa Fe' and c.altura_desde = 600
            and e.lado = 'impar' and e.lugar = 1 and e.estado = 'activo'`,
      );
      expect(enElLugarUno).toEqual([{ patente: 'AD444DD' }]);
    });

    it('genera vencidos por saldo agotado y estacionamientos por vencer', async () => {
      const ahora = reloj.ahora();
      const vencidos = await consultar<{ fin: Date; vence_en: Date; importe: string }>(
        `select e.fin, e.vence_en, e.importe from estacionamientos e
           join usuarios u on u.id = e.usuario_id
          where u.email like $1 and e.motivo_de_cierre = 'saldo_agotado'`,
        [SIMULADOS],
      );
      expect(vencidos.length).toBeGreaterThanOrEqual(3);
      for (const vencido of vencidos) {
        expect(vencido.fin).toEqual(vencido.vence_en);
        expect(vencido.fin.getTime()).toBeLessThan(ahora.getTime());
        expect(Number(vencido.importe)).toBeGreaterThan(0);
      }
      const porVencer = await contar(
        `select count(*) as total from estacionamientos e join usuarios u on u.id = e.usuario_id
          where u.email like $1 and e.estado = 'activo'
            and e.vence_en > $2 and e.vence_en < $2::timestamptz + interval '10 minutes'`,
        [SIMULADOS, ahora],
      );
      expect(porVencer).toBeGreaterThanOrEqual(3);
    });

    it('cobra con la regla real de la zona y deja las billeteras consistentes', async () => {
      const reglas = await consultar<{ zona_horaria: string }>(
        `select distinct e.regla_aplicada->>'zonaHoraria' as zona_horaria
           from estacionamientos e join usuarios u on u.id = e.usuario_id where u.email like $1`,
        [SIMULADOS],
      );
      expect(reglas).toEqual([{ zona_horaria: 'America/Argentina/Buenos_Aires' }]);
      const inconsistentes = await contar(
        `select count(*) as total from billeteras b join usuarios u on u.id = b.usuario_id
          where u.email like $1
            and b.saldo <> (select coalesce(sum(m.importe), 0) from movimientos m where m.billetera_id = b.id)`,
        [SIMULADOS],
      );
      expect(inconsistentes).toBe(0);
    });

    it('el agente ve los padrones con vehículos y el radar con vencidos', async () => {
      const radar = (await pedir('GET', `${base}/agente/radar`, agente)).json<Radar>();
      expect(radar.vencidos.length).toBeGreaterThanOrEqual(3);
      expect(radar.porVencer.length).toBeGreaterThanOrEqual(3);

      const [cuadraConVencido] = radar.vencidos;
      const padron = (
        await pedir(
          'GET',
          `${base}/agente/cuadras/${cuadraConVencido?.ubicacion.cuadraId ?? ''}/padron`,
          agente,
        )
      ).json<Padron>();
      const vehiculos = [...padron.manos.par.vehiculos, ...padron.manos.impar.vehiculos];
      expect(vehiculos.some((v) => v.situacion === 'vencido')).toBe(true);
    });

    it('repetirla no duplica conductores ni excede la ocupación pedida', async () => {
      const conductores = await contar(
        'select count(*) as total from usuarios where email like $1',
        [SIMULADOS],
      );
      const resumen = await simulador.ejecutar({
        municipio: 'firmat',
        ocupacion: 0.5,
        retroactiva: true,
        semilla: 8,
      });
      expect(resumen.iniciados).toBe(0);
      expect(
        await contar('select count(*) as total from usuarios where email like $1', [SIMULADOS]),
      ).toBe(conductores);
      const activos = await contar(
        "select count(*) as total from estacionamientos where estado = 'activo'",
      );
      expect(activos).toBeLessThanOrEqual(Math.round(resumen.capacidad * 0.5));
    });

    it('con el paso del tiempo cierra por saldo agotado y repone llegadas', async () => {
      reloj.avanzar(30);
      const resumen = await simulador.ejecutar({
        municipio: 'firmat',
        ocupacion: 0.5,
        retroactiva: false,
        semilla: 9,
      });
      expect(resumen.cerradosPorSaldo).toBeGreaterThanOrEqual(3);
      expect(resumen.retirados).toBeGreaterThan(0);
      expect(resumen.iniciados).toBeGreaterThan(0);
      const vencidosSinCerrar = await contar(
        `select count(*) as total from estacionamientos e join usuarios u on u.id = e.usuario_id
          where u.email like $1 and e.estado = 'activo' and e.vence_en <= $2`,
        [SIMULADOS, reloj.ahora()],
      );
      expect(vencidosSinCerrar).toBe(0);
    });
  });

  describe('limpieza', () => {
    it('borra solo lo simulado', async () => {
      // Un control de un agente real sobre un vehículo simulado se va con él.
      const [simulado] = await consultar<{ patente: string; calle: string; altura_desde: number }>(
        `select e.patente, c.calle, c.altura_desde from estacionamientos e
           join usuarios u on u.id = e.usuario_id join cuadras c on c.id = e.cuadra_id
          where u.email like $1 and e.estado = 'activo' limit 1`,
        [SIMULADOS],
      );
      if (!simulado) throw new Error('No hay actividad simulada para limpiar.');
      const cuadra = await cuadraDeDemo(prueba.conexion, simulado.calle, simulado.altura_desde);
      await pedir('POST', `${base}/controles`, agente, {
        patente: simulado.patente,
        ...puntoEnCuadra(cuadra, 0.5, 6),
      });
      const controlesReales = await contar(
        "select count(*) as total from controles where patente = 'AD444DD'",
      );

      const resumen = await simulador.limpiar();
      expect(resumen.estacionamientos).toBeGreaterThan(400);
      expect(resumen.controles).toBeGreaterThanOrEqual(1);

      expect(
        await contar(
          `select count(*) as total from estacionamientos e join usuarios u on u.id = e.usuario_id
            where u.email like $1`,
          [SIMULADOS],
        ),
      ).toBe(0);
      expect(
        await contar(
          'select count(*) as total from vehiculos v join usuarios u on u.id = v.usuario_id where u.email like $1',
          [SIMULADOS],
        ),
      ).toBe(0);
      expect(
        await contar('select count(*) as total from usuarios where email like $1 and activo', [
          SIMULADOS,
        ]),
      ).toBe(0);

      // Lo real queda intacto.
      const [real] = await consultar<{ estado: string }>(
        'select estado from estacionamientos where id = $1',
        [estacionamientoReal],
      );
      expect(real).toEqual({ estado: 'activo' });
      expect(
        await contar("select count(*) as total from controles where patente = 'AD444DD'"),
      ).toBe(controlesReales);
      expect(
        await contar(
          "select count(*) as total from usuarios where email = 'real@ejemplo.com' and activo",
        ),
      ).toBe(1);
      expect(
        await contar(
          "select count(*) as total from usuarios where email = 'simulacion@firmat.gob.ar' and activo",
        ),
      ).toBe(1);
    });

    it('después de limpiar se puede volver a simular', async () => {
      const resumen = await simulador.ejecutar({
        municipio: 'firmat',
        ocupacion: 0.2,
        retroactiva: true,
        semilla: 10,
      });
      expect(resumen.enCurso).toBeGreaterThan(0);
    });
  });
});
