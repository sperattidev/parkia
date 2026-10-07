import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Sesion, Usuario } from '@parkia/contracts';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';

import { ErrorDeApi } from '../comun/errores.js';
import type { Entorno } from '../config/entorno.js';
import { Correo } from '../correo/correo.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { codigosDeAcceso, membresias, municipios, sesiones, usuarios } from '../db/esquema.js';
import {
  HASH_SENUELO,
  generarCodigo,
  generarToken,
  huella,
  huellasIguales,
  verificarContrasena,
} from './cripto.js';
import type { Membresia, UsuarioAutenticado } from './tipos.js';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Vigencia de un código enviado por email. */
export const VIGENCIA_CODIGO = 10 * MINUTO;
/** Intentos fallidos permitidos por código antes de invalidarlo. */
export const MAX_INTENTOS_CODIGO = 5;
/** Códigos que se pueden pedir para un mismo email en la ventana de 15 minutos. */
export const MAX_CODIGOS_POR_VENTANA = 5;
const VENTANA_CODIGOS = 15 * MINUTO;
/** Conductores: sesión larga en su propio teléfono. */
export const VIGENCIA_SESION_CONDUCTOR = 30 * 24 * HORA;
/** Personal municipal: una jornada de trabajo. */
export const VIGENCIA_SESION_PERSONAL = 12 * HORA;

export interface DatosDeConexion {
  readonly ip?: string | undefined;
  readonly agenteDeUsuario?: string | undefined;
}

const credencialesInvalidas = (codigo: string, mensaje: string) =>
  new ErrorDeApi(HttpStatus.UNAUTHORIZED, codigo, mensaje);

@Injectable()
export class AutenticacionService {
  private readonly logger = new Logger(AutenticacionService.name);
  private readonly clave: string;

  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly correo: Correo,
    config: ConfigService<Entorno, true>,
  ) {
    this.clave = config.get('AUTH_SECRET', { infer: true });
  }

  /**
   * Envía un código de acceso. Siempre responde igual, exista o no la cuenta,
   * para no revelar qué emails están registrados.
   */
  async solicitarCodigo(email: string, ahora = new Date()): Promise<void> {
    const { db } = this.conexion;
    const [{ recientes } = { recientes: 0 }] = await db
      .select({ recientes: sql<number>`count(*)::int` })
      .from(codigosDeAcceso)
      .where(
        and(
          eq(codigosDeAcceso.email, email),
          gt(codigosDeAcceso.creadoEn, new Date(ahora.getTime() - VENTANA_CODIGOS)),
        ),
      );

    if (recientes >= MAX_CODIGOS_POR_VENTANA) {
      this.logger.warn({ email }, 'Límite de códigos por email alcanzado');
      return;
    }

    const codigo = generarCodigo();
    await db.transaction(async (tx) => {
      // Un código nuevo invalida los anteriores.
      await tx
        .update(codigosDeAcceso)
        .set({ expiraEn: ahora })
        .where(and(eq(codigosDeAcceso.email, email), isNull(codigosDeAcceso.usadoEn)));
      await tx.insert(codigosDeAcceso).values({
        email,
        hashCodigo: huella(this.clave, `${email}:${codigo}`),
        expiraEn: new Date(ahora.getTime() + VIGENCIA_CODIGO),
      });
    });

    await this.correo.enviar({
      para: email,
      asunto: `Tu código de Parkia: ${codigo}`,
      texto: [
        `Tu código para ingresar a Parkia es: ${codigo}`,
        '',
        `Vence en ${VIGENCIA_CODIGO / MINUTO} minutos. Si no lo pediste, ignorá este mensaje.`,
      ].join('\n'),
    });
  }

  async ingresarConCodigo(
    email: string,
    codigo: string,
    conexion: DatosDeConexion,
    ahora = new Date(),
  ): Promise<Sesion> {
    const valido = await this.conexion.db.transaction(async (tx) => {
      const [vigente] = await tx
        .select()
        .from(codigosDeAcceso)
        .where(
          and(
            eq(codigosDeAcceso.email, email),
            isNull(codigosDeAcceso.usadoEn),
            gt(codigosDeAcceso.expiraEn, ahora),
          ),
        )
        .orderBy(desc(codigosDeAcceso.creadoEn))
        .limit(1)
        .for('update');

      if (!vigente || vigente.intentos >= MAX_INTENTOS_CODIGO) return false;

      const coincide = huellasIguales(vigente.hashCodigo, huella(this.clave, `${email}:${codigo}`));
      await tx
        .update(codigosDeAcceso)
        .set(coincide ? { usadoEn: ahora } : { intentos: vigente.intentos + 1 })
        .where(eq(codigosDeAcceso.id, vigente.id));
      return coincide;
    });

    if (!valido) {
      throw credencialesInvalidas(
        'CODIGO_INVALIDO',
        'El código es incorrecto o venció. Pedí uno nuevo.',
      );
    }

    const [usuario] = await this.conexion.db
      .insert(usuarios)
      .values({ email })
      .onConflictDoUpdate({ target: usuarios.email, set: { actualizadoEn: ahora } })
      .returning({ id: usuarios.id, activo: usuarios.activo });

    if (!usuario?.activo) {
      throw new ErrorDeApi(
        HttpStatus.FORBIDDEN,
        'CUENTA_INHABILITADA',
        'La cuenta está inhabilitada.',
      );
    }
    return this.crearSesion(usuario.id, VIGENCIA_SESION_CONDUCTOR, conexion, ahora);
  }

  async ingresarConContrasena(
    email: string,
    contrasena: string,
    conexion: DatosDeConexion,
    ahora = new Date(),
  ): Promise<Sesion> {
    const [usuario] = await this.conexion.db
      .select({ id: usuarios.id, hash: usuarios.hashContrasena, activo: usuarios.activo })
      .from(usuarios)
      .where(eq(usuarios.email, email))
      .limit(1);

    // Siempre se verifica un hash (real o señuelo) para no revelar por tiempo si el email existe.
    const correcta = await verificarContrasena(contrasena, usuario?.hash ?? HASH_SENUELO);
    if (!usuario?.hash || !correcta || !usuario.activo) {
      throw credencialesInvalidas('CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos.');
    }
    return this.crearSesion(usuario.id, VIGENCIA_SESION_PERSONAL, conexion, ahora);
  }

  /** Resuelve un token Bearer a su usuario, o `null` si no es válido. */
  async autenticar(token: string, ahora = new Date()): Promise<UsuarioAutenticado | null> {
    const [fila] = await this.conexion.db
      .select({
        sesionId: sesiones.id,
        id: usuarios.id,
        email: usuarios.email,
        nombre: usuarios.nombre,
      })
      .from(sesiones)
      .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
      .where(
        and(
          eq(sesiones.hashToken, huella(this.clave, token)),
          isNull(sesiones.revocadaEn),
          gt(sesiones.expiraEn, ahora),
          eq(usuarios.activo, true),
        ),
      )
      .limit(1);

    if (!fila) return null;
    return { ...fila, membresias: await this.membresias(fila.id) };
  }

  async cerrarSesion(sesionId: string, ahora = new Date()): Promise<void> {
    await this.conexion.db
      .update(sesiones)
      .set({ revocadaEn: ahora })
      .where(eq(sesiones.id, sesionId));
  }

  aUsuario(usuario: Omit<UsuarioAutenticado, 'sesionId'>): Usuario {
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      membresias: usuario.membresias.map(({ municipio, rol }) => ({ municipio, rol })),
    };
  }

  private async crearSesion(
    usuarioId: string,
    vigencia: number,
    conexion: DatosDeConexion,
    ahora: Date,
  ): Promise<Sesion> {
    const token = generarToken();
    const expiraEn = new Date(ahora.getTime() + vigencia);
    await this.conexion.db.insert(sesiones).values({
      usuarioId,
      hashToken: huella(this.clave, token),
      expiraEn,
      ip: conexion.ip ?? null,
      agenteDeUsuario: conexion.agenteDeUsuario?.slice(0, 300) ?? null,
    });

    const [usuario] = await this.conexion.db
      .select({ id: usuarios.id, email: usuarios.email, nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId));
    if (!usuario) throw new Error(`Usuario ${usuarioId} inexistente al crear la sesión.`);

    return {
      token,
      expiraEn: expiraEn.toISOString(),
      usuario: this.aUsuario({ ...usuario, membresias: await this.membresias(usuarioId) }),
    };
  }

  private membresias(usuarioId: string): Promise<Membresia[]> {
    return this.conexion.db
      .select({ municipioId: municipios.id, municipio: municipios.slug, rol: membresias.rol })
      .from(membresias)
      .innerJoin(municipios, eq(municipios.id, membresias.municipioId))
      .where(and(eq(membresias.usuarioId, usuarioId), eq(municipios.activo, true)));
  }
}
