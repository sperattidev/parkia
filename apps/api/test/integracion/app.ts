import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { AutenticacionService } from '../../src/autenticacion/autenticacion.service.js';
import { Reloj } from '../../src/comun/reloj.js';
import { configurarApp } from '../../src/configurar-app.js';
import { Correo, type MensajeDeCorreo } from '../../src/correo/correo.js';
import type { Conexion } from '../../src/db/conexion.js';
import { CONEXION } from '../../src/db/db.module.js';

/** Reloj controlable: los tests fijan y avanzan la hora. */
export class RelojDePrueba extends Reloj {
  private actual: Date;

  constructor(inicial: Date) {
    super();
    this.actual = inicial;
  }

  ahora(): Date {
    return new Date(this.actual);
  }

  fijar(instante: Date): void {
    this.actual = instante;
  }

  avanzar(minutos: number): void {
    this.actual = new Date(this.actual.getTime() + minutos * 60_000);
  }
}

/** Captura los emails en lugar de enviarlos. */
export class CorreoEnMemoria extends Correo {
  readonly enviados: MensajeDeCorreo[] = [];

  enviar(mensaje: MensajeDeCorreo): Promise<void> {
    this.enviados.push(mensaje);
    return Promise.resolve();
  }

  /** Código de 6 dígitos del último email enviado a esa dirección. */
  ultimoCodigo(para: string): string {
    const mensaje = this.enviados.findLast((m) => m.para === para);
    const codigo = /\b(\d{6})\b/.exec(mensaje?.texto ?? '')?.[1];
    if (!codigo) throw new Error(`No se envió ningún código a ${para}.`);
    return codigo;
  }
}

export interface AppDePrueba {
  readonly app: NestFastifyApplication;
  readonly conexion: Conexion;
  readonly correo: CorreoEnMemoria;
  readonly autenticacion: AutenticacionService;
}

/** Levanta la aplicación real (mismo módulo y misma configuración que producción). */
export async function crearAppDePrueba(opciones: { reloj?: Reloj } = {}): Promise<AppDePrueba> {
  const correo = new CorreoEnMemoria();
  let constructor = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Correo)
    .useValue(correo);
  if (opciones.reloj) constructor = constructor.overrideProvider(Reloj).useValue(opciones.reloj);
  const modulo = await constructor.compile();
  const app = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configurarApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    correo,
    conexion: app.get<Conexion>(CONEXION),
    autenticacion: app.get(AutenticacionService),
  };
}

/**
 * Sesión de conductor con el flujo real de código por email. Usa el servicio
 * directamente para no consumir el cupo por IP de los endpoints de credenciales.
 */
export async function sesionDeConductor(prueba: AppDePrueba, email: string): Promise<string> {
  await prueba.autenticacion.solicitarCodigo(email);
  const sesion = await prueba.autenticacion.ingresarConCodigo(
    email,
    prueba.correo.ultimoCodigo(email),
    {},
  );
  return sesion.token;
}

/** Sesión de personal municipal (contraseña). */
export async function sesionDePersonal(
  prueba: AppDePrueba,
  email: string,
  contrasena: string,
): Promise<string> {
  return (await prueba.autenticacion.ingresarConContrasena(email, contrasena, {})).token;
}

/** Encabezado de autorización para `app.inject`. */
export const conToken = (token: string) => ({ authorization: `Bearer ${token}` });
