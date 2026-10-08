import type {
  CredencialTemporal,
  CuadrasDeGestion,
  EntradaDeAuditoria,
  FilaDeControl,
  FilaDeEstacionamiento,
  ListaPaginada,
  Mapa,
  Persona,
  ResumenDeGestion,
  Usuario,
  ZonaDeGestion,
} from '@parkia/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { crearPersonal } from '../../src/db/crear-personal.js';
import { sembrar } from '../../src/db/sembrar.js';
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

const ar = (fechaHora: string) => new Date(`${fechaHora}-03:00`);

const CLAVE = 'clave-de-la-intendencia';

describe('Panel municipal (integración)', () => {
  const reloj = new RelojDePrueba(ar('2026-10-05T10:00'));
  let prueba: AppDePrueba;
  let admin: string;
  let agente: string;
  let conductor: string;
  let sarmiento: Awaited<ReturnType<typeof cuadraDeDemo>>;

  const base = '/v1/municipios/firmat';
  const gestion = `${base}/gestion`;
  const pedir = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
    prueba.app.inject({ method, url, headers: conToken(token), ...(payload && { payload }) });

  beforeAll(async () => {
    prueba = await crearAppDePrueba({ reloj });
    await sembrar(prueba.conexion.db);
    await crearPersonal(prueba.conexion.db, {
      email: 'intendencia@firmat.gob.ar',
      municipio: 'firmat',
      rol: 'admin',
      contrasena: CLAVE,
    });
    await crearPersonal(prueba.conexion.db, {
      email: 'transito@firmat.gob.ar',
      municipio: 'firmat',
      rol: 'agente',
      contrasena: 'clave-del-agente-123',
    });
    admin = await sesionDePersonal(prueba, 'intendencia@firmat.gob.ar', CLAVE);
    agente = await sesionDePersonal(prueba, 'transito@firmat.gob.ar', 'clave-del-agente-123');
    conductor = await sesionDeConductor(prueba, 'vecina@ejemplo.com');
    sarmiento = await cuadraDeDemo(prueba.conexion, 'Sarmiento', 700);

    // Actividad: un estacionamiento cobrado y otro en curso, y un control.
    await pedir('POST', '/v1/vehiculos', conductor, { patente: 'AB123CD' });
    await pedir('POST', `${base}/billetera/cargas-de-prueba`, conductor, { importe: 500_000 });
    const iniciado = await pedir('POST', `${base}/estacionamientos`, conductor, {
      patente: 'AB123CD',
      cuadraId: sarmiento.id,
      lado: 'par',
    });
    reloj.avanzar(61);
    await pedir(
      'POST',
      `${base}/estacionamientos/${iniciado.json<{ id: string }>().id}/finalizar`,
      conductor,
    );
    await pedir('POST', `${base}/estacionamientos`, conductor, {
      patente: 'AB123CD',
      cuadraId: sarmiento.id,
      lado: 'impar',
    });
    await pedir('POST', `${base}/controles`, agente, {
      patente: 'ZZ999ZZ',
      ...puntoEnCuadra(sarmiento, 0.5, 6),
    });
  });

  afterAll(async () => {
    await prueba.app.close();
  });

  it('solo los administradores del municipio entran al panel', async () => {
    expect((await pedir('GET', `${gestion}/resumen`, agente)).statusCode).toBe(403);
    expect((await pedir('GET', `${gestion}/resumen`, conductor)).statusCode).toBe(403);
  });

  describe('resumen', () => {
    it('suma lo recaudado, los estacionamientos, la ocupación y los controles', async () => {
      const respuesta = await pedir(
        'GET',
        `${gestion}/resumen?desde=2026-10-01&hasta=2026-10-05`,
        admin,
      );
      expect(respuesta.statusCode).toBe(200);
      const resumen = respuesta.json<ResumenDeGestion>();
      expect(resumen).toMatchObject({
        periodo: { desde: '2026-10-01', hasta: '2026-10-05' },
        // 61 minutos en el Microcentro: 137.500 centavos (ver tarifas.md).
        recaudado: 137_500,
        cargas: 500_000,
        estacionamientos: 2,
        minutosPromedio: 61,
        controles: 1,
        infracciones: 1,
        ahora: { activos: 1 },
      });
      expect(resumen.porDia).toHaveLength(5);
      expect(resumen.porDia.at(-1)).toEqual({
        fecha: '2026-10-05',
        recaudado: 137_500,
        estacionamientos: 2,
      });
      expect(resumen.porHora[10]?.estacionamientos).toBe(1);
      expect(resumen.porHora[11]?.estacionamientos).toBe(1);
      expect(resumen.porZona.find((z) => z.zona.nombre === 'Microcentro')).toMatchObject({
        recaudado: 137_500,
        estacionamientos: 2,
        ocupadosAhora: 1,
      });
    });

    it('rechaza períodos invertidos o de más de un año', async () => {
      const invertido = await pedir(
        'GET',
        `${gestion}/resumen?desde=2026-10-05&hasta=2026-10-01`,
        admin,
      );
      expect(invertido.json()).toMatchObject({ codigo: 'PERIODO_INVALIDO' });
      const largo = await pedir(
        'GET',
        `${gestion}/resumen?desde=2025-01-01&hasta=2026-10-05`,
        admin,
      );
      expect(largo.statusCode).toBe(422);
    });
  });

  describe('listados y exportaciones', () => {
    it('lista estacionamientos con su ubicación y filtra por patente parcial', async () => {
      const lista = (
        await pedir('GET', `${gestion}/estacionamientos?patente=ab1&porPagina=1`, admin)
      ).json<ListaPaginada<FilaDeEstacionamiento>>();
      expect(lista).toMatchObject({ total: 2, pagina: 1, porPagina: 1 });
      expect(lista.elementos[0]).toMatchObject({
        patente: 'AB123CD',
        estado: 'activo',
        direccion: expect.stringMatching(/^Sarmiento \d+ · mano impar$/) as unknown,
      });
      const ninguno = (await pedir('GET', `${gestion}/estacionamientos?patente=XX`, admin)).json<
        ListaPaginada<FilaDeEstacionamiento>
      >();
      expect(ninguno.total).toBe(0);
    });

    it('exporta estacionamientos en CSV para Excel', async () => {
      const respuesta = await pedir('GET', `${gestion}/exportaciones/estacionamientos`, admin);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers['content-type']).toContain('text/csv');
      expect(respuesta.headers['content-disposition']).toContain('estacionamientos-firmat.csv');
      const [encabezado, ...filas] = respuesta.body.replace('﻿', '').trim().split('\r\n');
      expect(respuesta.body.startsWith('﻿')).toBe(true);
      expect(encabezado).toBe(
        'Inicio;Fin;Patente;Zona;Ubicación;Minutos;Importe ($);Estado;Cierre',
      );
      expect(filas).toHaveLength(2);
      expect(filas[1]).toContain(';AB123CD;Microcentro;');
      expect(filas[1]).toContain(';61;1375,00;Finalizado;Finalizado por el conductor');
    });

    it('lista y exporta los controles con el agente', async () => {
      const lista = (await pedir('GET', `${gestion}/controles`, admin)).json<
        ListaPaginada<FilaDeControl>
      >();
      expect(lista.elementos).toMatchObject([
        {
          patente: 'ZZ999ZZ',
          resultado: 'sin_estacionamiento',
          habilitado: false,
          calle: 'Sarmiento',
        },
      ]);
      const csv = (
        await pedir(
          'GET',
          `${gestion}/exportaciones/controles?resultado=sin_estacionamiento`,
          admin,
        )
      ).body;
      expect(csv).toContain(
        ';ZZ999ZZ;Sin estacionamiento;transito@firmat.gob.ar;Sarmiento;Microcentro;',
      );
    });
  });

  describe('zonas, tarifas y cuadras', () => {
    let microcentro: ZonaDeGestion;

    beforeAll(async () => {
      const zonas = (await pedir('GET', `${gestion}/zonas`, admin)).json<ZonaDeGestion[]>();
      const encontrada = zonas.find((z) => z.nombre === 'Microcentro');
      if (!encontrada) throw new Error('Falta la zona del microcentro.');
      microcentro = encontrada;
    });

    it('informa cuadras y capacidad de cada zona', () => {
      expect(microcentro).toMatchObject({ activa: true, cuadras: 24 });
      expect(microcentro.capacidad).toBeGreaterThan(400);
    });

    it('valida la tarifa con las reglas del dominio', async () => {
      const respuesta = await pedir('PATCH', `${gestion}/zonas/${microcentro.id}`, admin, {
        regla: {
          ...(microcentro.regla as object),
          horario: [{ dias: [1, 2, 3, 4, 5], desde: '20:00', hasta: '08:00' }],
        },
      });
      expect(respuesta.statusCode).toBe(400);
      expect(JSON.stringify(respuesta.json())).toContain('medianoche');
    });

    it('cambia la tarifa y deja constancia en la auditoría', async () => {
      const regla = microcentro.regla as { tramos: { desdeMinuto: number; precioHora: number }[] };
      const respuesta = await pedir('PATCH', `${gestion}/zonas/${microcentro.id}`, admin, {
        regla: { ...regla, tramos: [{ desdeMinuto: 0, precioHora: 120_000 }] },
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json<ZonaDeGestion>().resumen.tarifa.precioHora).toBe(120_000);

      const [ultima] = (await pedir('GET', `${gestion}/auditoria`, admin)).json<
        ListaPaginada<EntradaDeAuditoria>
      >().elementos;
      expect(ultima).toMatchObject({
        accion: 'zona.tarifa',
        entidadId: microcentro.id,
        usuario: { email: 'intendencia@firmat.gob.ar' },
      });
    });

    it('no permite dos zonas con el mismo nombre', async () => {
      const respuesta = await pedir('POST', `${gestion}/zonas`, admin, {
        nombre: 'microcentro',
        color: '#112233',
        regla: microcentro.regla,
      });
      expect(respuesta.json()).toMatchObject({ codigo: 'ZONA_EXISTENTE' });
    });

    it('arma una zona nueva asignándole cuadras', async () => {
      const creada = await pedir('POST', `${gestion}/zonas`, admin, {
        nombre: 'Terminal',
        color: '#c2410c',
        regla: microcentro.regla,
      });
      expect(creada.statusCode).toBe(201);
      const terminal = creada.json<ZonaDeGestion>();
      expect(terminal).toMatchObject({ color: '#C2410C', cuadras: 0 });

      const cuadras = (
        await pedir('PATCH', `${gestion}/cuadras/${sarmiento.id}`, admin, {
          zonaId: terminal.id,
          lugaresPar: 10,
        })
      ).json<CuadrasDeGestion>();
      expect(cuadras.features.find((c) => c.id === sarmiento.id)?.properties).toMatchObject({
        zonaId: terminal.id,
        lugares: { par: 10 },
        color: '#C2410C',
      });

      // El mapa público ya muestra la cuadra en la zona nueva.
      const mapa = (await prueba.app.inject({ method: 'GET', url: `${base}/mapa` })).json<Mapa>();
      expect(mapa.cuadras.features.find((c) => c.id === sarmiento.id)?.properties.zonaId).toBe(
        terminal.id,
      );
    });

    it('una cuadra sin zona deja de ser tarifada', async () => {
      await pedir('PATCH', `${gestion}/cuadras/${sarmiento.id}`, admin, { zonaId: null });
      const mapa = (await prueba.app.inject({ method: 'GET', url: `${base}/mapa` })).json<Mapa>();
      expect(mapa.cuadras.features.some((c) => c.id === sarmiento.id)).toBe(false);
    });
  });

  describe('personal', () => {
    let nueva: CredencialTemporal;
    let token: string;

    it('da de alta con una contraseña temporal', async () => {
      const respuesta = await pedir('POST', `${gestion}/personal`, admin, {
        email: 'Inspectora@Firmat.gob.ar',
        nombre: 'Laura Gómez',
        rol: 'agente',
      });
      expect(respuesta.statusCode).toBe(201);
      nueva = respuesta.json<CredencialTemporal>();
      expect(nueva.persona).toMatchObject({
        email: 'inspectora@firmat.gob.ar',
        nombre: 'Laura Gómez',
        rol: 'agente',
        activo: true,
        debeCambiarContrasena: true,
      });
      expect(nueva.contrasenaTemporal).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
    });

    it('con la contraseña temporal solo puede cambiarla', async () => {
      token = await sesionDePersonal(
        prueba,
        'inspectora@firmat.gob.ar',
        nueva.contrasenaTemporal ?? '',
      );
      const yo = (await pedir('GET', '/v1/auth/yo', token)).json<Usuario>();
      expect(yo.debeCambiarContrasena).toBe(true);
      const bloqueada = await pedir('GET', `${base}/agente/jornada`, token);
      expect(bloqueada.json()).toMatchObject({ codigo: 'CAMBIO_DE_CONTRASENA_REQUERIDO' });

      const cambio = await pedir('POST', '/v1/auth/contrasena', token, {
        actual: nueva.contrasenaTemporal,
        nueva: 'mi-clave-nueva-y-larga',
      });
      expect(cambio.statusCode).toBe(204);
      expect((await pedir('GET', `${base}/agente/jornada`, token)).statusCode).toBe(200);
    });

    it('no convierte un email de conductor en cuenta de personal', async () => {
      const respuesta = await pedir('POST', `${gestion}/personal`, admin, {
        email: 'vecina@ejemplo.com',
        nombre: 'Vecina',
        rol: 'agente',
      });
      expect(respuesta.json()).toMatchObject({ codigo: 'EMAIL_DE_CONDUCTOR' });
    });

    it('nadie se quita su propio acceso de administrador', async () => {
      const yo = (await pedir('GET', '/v1/auth/yo', admin)).json<Usuario>();
      const respuesta = await pedir('PATCH', `${gestion}/personal/${yo.id}`, admin, {
        rol: 'agente',
      });
      expect(respuesta.json()).toMatchObject({ codigo: 'NO_PODES_QUITARTE_ACCESO' });
    });

    it('dar de baja corta el acceso en el momento', async () => {
      const baja = await pedir('PATCH', `${gestion}/personal/${nueva.persona.usuarioId}`, admin, {
        activo: false,
      });
      expect(baja.json<Persona>().activo).toBe(false);
      expect((await pedir('GET', `${base}/agente/jornada`, token)).statusCode).toBe(403);

      const alta = await pedir('PATCH', `${gestion}/personal/${nueva.persona.usuarioId}`, admin, {
        activo: true,
      });
      expect(alta.json<Persona>()).toMatchObject({ activo: true, rol: 'agente' });
    });

    it('restablecer la contraseña cierra sus sesiones', async () => {
      const respuesta = await pedir(
        'POST',
        `${gestion}/personal/${nueva.persona.usuarioId}/restablecimientos`,
        admin,
      );
      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json<CredencialTemporal>().contrasenaTemporal).not.toBeNull();
      expect((await pedir('GET', '/v1/auth/yo', token)).statusCode).toBe(401);
    });

    it('lista el personal con su rol y actividad', async () => {
      const personal = (await pedir('GET', `${gestion}/personal`, admin)).json<Persona[]>();
      expect(personal.map((p) => [p.email, p.rol])).toEqual(
        expect.arrayContaining([
          ['intendencia@firmat.gob.ar', 'admin'],
          ['transito@firmat.gob.ar', 'agente'],
          ['inspectora@firmat.gob.ar', 'agente'],
        ]),
      );
      expect(personal.find((p) => p.email === 'transito@firmat.gob.ar')?.controlesHoy).toBe(1);
    });

    it('la auditoría registra altas, bajas y restablecimientos', async () => {
      const acciones = (await pedir('GET', `${gestion}/auditoria?porPagina=200`, admin))
        .json<ListaPaginada<EntradaDeAuditoria>>()
        .elementos.map((e) => e.accion);
      expect(acciones).toEqual(
        expect.arrayContaining([
          'personal.alta',
          'personal.baja',
          'personal.cambio',
          'personal.restablecimiento',
          'cuadra.cambio',
          'zona.alta',
        ]),
      );
    });
  });
});
