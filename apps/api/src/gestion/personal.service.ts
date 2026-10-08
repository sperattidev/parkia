import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CredencialTemporal, Persona, RolMunicipal } from '@parkia/contracts';
import { inicioDelDia } from '@parkia/domain';
import { and, asc, count, eq, gte, isNull, max, ne, sql } from 'drizzle-orm';

import { generarContrasenaTemporal, hashearContrasena } from '../autenticacion/cripto.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { ErrorDeApi, NoEncontrado } from '../comun/errores.js';
import { Reloj } from '../comun/reloj.js';
import type { Conexion, Transaccion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { controles, membresias, sesiones, usuarios } from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { registrarAuditoria } from './auditoria.js';

type RolAsignable = Extract<RolMunicipal, 'agente' | 'admin'>;

const invalido = (codigo: string, mensaje: string) =>
  new ErrorDeApi(HttpStatus.UNPROCESSABLE_ENTITY, codigo, mensaje);

/**
 * Personal municipal administrado desde el panel. Reglas de seguridad:
 * - Un email de conductor no se convierte en cuenta de personal: el
 *   administrador conocería la contraseña de la cuenta de un vecino.
 * - Solo se restablece la contraseña de quien trabaja únicamente en este
 *   municipio; si también está en otro, lo hace el equipo de Parkia.
 * - Nadie se quita su propio acceso y siempre queda al menos un administrador.
 */
@Injectable()
export class PersonalService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly reloj: Reloj,
  ) {}

  async listar(slugMunicipio: string): Promise<Persona[]> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    return this.consulta(municipio);
  }

  async alta(
    autor: UsuarioAutenticado,
    slugMunicipio: string,
    datos: { email: string; nombre: string; rol: RolAsignable },
  ): Promise<CredencialTemporal> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const [existente] = await this.conexion.db
      .select({ id: usuarios.id, hash: usuarios.hashContrasena })
      .from(usuarios)
      .where(eq(usuarios.email, datos.email));

    if (existente && !existente.hash) {
      throw new ErrorDeApi(
        HttpStatus.CONFLICT,
        'EMAIL_DE_CONDUCTOR',
        'Ese email ya está registrado como conductor. Usá un email institucional para el personal.',
      );
    }
    if (existente && (await this.membresiasActivas(existente.id, municipio)).length > 0) {
      throw new ErrorDeApi(
        HttpStatus.CONFLICT,
        'PERSONAL_EXISTENTE',
        'Esa persona ya forma parte del personal del municipio.',
      );
    }

    // Quien ya tiene cuenta de personal (en otro municipio) conserva su contraseña.
    const contrasenaTemporal = existente ? null : generarContrasenaTemporal();
    const usuarioId = await this.conexion.db.transaction(async (tx) => {
      let id = existente?.id;
      if (!id) {
        const [creado] = await tx
          .insert(usuarios)
          .values({
            email: datos.email,
            nombre: datos.nombre,
            hashContrasena: await hashearContrasena(contrasenaTemporal ?? ''),
            debeCambiarContrasena: true,
          })
          .returning({ id: usuarios.id });
        if (!creado) throw new Error('No se pudo crear el usuario.');
        id = creado.id;
      }
      await this.asignarRol(tx, id, municipio, datos.rol);
      await registrarAuditoria(tx, {
        municipioId: municipio.id,
        usuarioId: autor.id,
        accion: 'personal.alta',
        entidad: 'usuario',
        entidadId: id,
        despues: { email: datos.email, nombre: datos.nombre, rol: datos.rol },
      });
      return id;
    });
    return { persona: await this.persona(municipio, usuarioId), contrasenaTemporal };
  }

  async cambiar(
    autor: UsuarioAutenticado,
    slugMunicipio: string,
    usuarioId: string,
    cambio: { rol?: RolAsignable | undefined; activo?: boolean | undefined },
  ): Promise<Persona> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const actual = await this.persona(municipio, usuarioId);
    const pierdeAdmin =
      actual.activo &&
      actual.rol === 'admin' &&
      (cambio.activo === false || (cambio.rol !== undefined && cambio.rol !== 'admin'));

    if (usuarioId === autor.id && pierdeAdmin && !autor.administradorDeParkia) {
      throw invalido(
        'NO_PODES_QUITARTE_ACCESO',
        'No podés quitarte tu propio acceso de administrador. Pedíselo a otro administrador.',
      );
    }
    if (pierdeAdmin && (await this.administradoresActivos(municipio)) <= 1) {
      throw invalido(
        'ULTIMO_ADMINISTRADOR',
        'Es el único administrador del municipio: primero agregá a otra persona como administradora.',
      );
    }

    await this.conexion.db.transaction(async (tx) => {
      if (cambio.activo === false) {
        await tx
          .update(membresias)
          .set({ activa: false })
          .where(
            and(eq(membresias.usuarioId, usuarioId), eq(membresias.municipioId, municipio.id)),
          );
      } else if (cambio.rol ?? cambio.activo) {
        await this.asignarRol(tx, usuarioId, municipio, cambio.rol ?? this.asignable(actual.rol));
      }
      await registrarAuditoria(tx, {
        municipioId: municipio.id,
        usuarioId: autor.id,
        accion: cambio.activo === false ? 'personal.baja' : 'personal.cambio',
        entidad: 'usuario',
        entidadId: usuarioId,
        antes: { rol: actual.rol, activo: actual.activo },
        despues: cambio,
      });
    });
    return this.persona(municipio, usuarioId);
  }

  /** Genera una contraseña temporal nueva y cierra todas las sesiones de la persona. */
  async restablecer(
    autor: UsuarioAutenticado,
    slugMunicipio: string,
    usuarioId: string,
  ): Promise<CredencialTemporal> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    await this.persona(municipio, usuarioId);
    if (usuarioId === autor.id) {
      throw invalido(
        'USAR_CAMBIO_DE_CONTRASENA',
        'Para tu propia cuenta usá «Cambiar contraseña».',
      );
    }
    if (!autor.administradorDeParkia && !(await this.trabajaSoloAca(usuarioId, municipio))) {
      throw new ErrorDeApi(
        HttpStatus.FORBIDDEN,
        'RESTABLECIMIENTO_NO_PERMITIDO',
        'Esta persona también trabaja en otro municipio: su contraseña la restablece el equipo de Parkia.',
      );
    }

    const contrasenaTemporal = generarContrasenaTemporal();
    const hashContrasena = await hashearContrasena(contrasenaTemporal);
    const ahora = this.reloj.ahora();
    await this.conexion.db.transaction(async (tx) => {
      await tx
        .update(usuarios)
        .set({ hashContrasena, debeCambiarContrasena: true })
        .where(eq(usuarios.id, usuarioId));
      await tx
        .update(sesiones)
        .set({ revocadaEn: ahora })
        .where(and(eq(sesiones.usuarioId, usuarioId), isNull(sesiones.revocadaEn)));
      await registrarAuditoria(tx, {
        municipioId: municipio.id,
        usuarioId: autor.id,
        accion: 'personal.restablecimiento',
        entidad: 'usuario',
        entidadId: usuarioId,
      });
    });
    return { persona: await this.persona(municipio, usuarioId), contrasenaTemporal };
  }

  private asignable(rol: RolMunicipal): RolAsignable {
    return rol === 'admin' ? 'admin' : 'agente';
  }

  /** Deja a la persona con un único rol activo en el municipio. */
  private async asignarRol(
    tx: Transaccion,
    usuarioId: string,
    municipio: Municipio,
    rol: RolAsignable,
  ): Promise<void> {
    await tx
      .update(membresias)
      .set({ activa: false })
      .where(
        and(
          eq(membresias.usuarioId, usuarioId),
          eq(membresias.municipioId, municipio.id),
          ne(membresias.rol, rol),
        ),
      );
    await tx
      .insert(membresias)
      .values({ usuarioId, municipioId: municipio.id, rol })
      .onConflictDoUpdate({
        target: [membresias.usuarioId, membresias.municipioId, membresias.rol],
        set: { activa: true },
      });
  }

  private membresiasActivas(usuarioId: string, municipio: Municipio) {
    return this.conexion.db
      .select({ rol: membresias.rol })
      .from(membresias)
      .where(
        and(
          eq(membresias.usuarioId, usuarioId),
          eq(membresias.municipioId, municipio.id),
          eq(membresias.activa, true),
        ),
      );
  }

  private async administradoresActivos(municipio: Municipio): Promise<number> {
    const [fila] = await this.conexion.db
      .select({ total: count() })
      .from(membresias)
      .innerJoin(usuarios, eq(usuarios.id, membresias.usuarioId))
      .where(
        and(
          eq(membresias.municipioId, municipio.id),
          eq(membresias.rol, 'admin'),
          eq(membresias.activa, true),
          eq(usuarios.activo, true),
        ),
      );
    return fila?.total ?? 0;
  }

  private async trabajaSoloAca(usuarioId: string, municipio: Municipio): Promise<boolean> {
    const [usuario] = await this.conexion.db
      .select({ parkia: usuarios.administradorDeParkia })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId));
    if (usuario?.parkia) return false;
    const [otras] = await this.conexion.db
      .select({ total: count() })
      .from(membresias)
      .where(
        and(
          eq(membresias.usuarioId, usuarioId),
          ne(membresias.municipioId, municipio.id),
          eq(membresias.activa, true),
        ),
      );
    return (otras?.total ?? 0) === 0;
  }

  private async persona(municipio: Municipio, usuarioId: string): Promise<Persona> {
    const [persona] = await this.consulta(municipio, usuarioId);
    if (!persona) {
      throw new NoEncontrado(
        'PERSONA_NO_ENCONTRADA',
        'Esa persona no forma parte del personal del municipio.',
      );
    }
    return persona;
  }

  /**
   * Una fila por persona con su rol en el municipio: el activo, o el último que
   * tuvo si está dada de baja. Administrador prevalece sobre agente.
   */
  private async consulta(municipio: Municipio, usuarioId?: string): Promise<Persona[]> {
    const desde = inicioDelDia(this.reloj.ahora(), municipio.zonaHoraria);
    const filas = await this.conexion.db
      .select({
        usuarioId: usuarios.id,
        email: usuarios.email,
        nombre: usuarios.nombre,
        debeCambiarContrasena: usuarios.debeCambiarContrasena,
        usuarioActivo: usuarios.activo,
        rol: membresias.rol,
        activa: membresias.activa,
        actualizada: membresias.actualizadoEn,
        ultimoIngreso:
          sql<Date | null>`(SELECT ${max(sesiones.creadoEn)} FROM ${sesiones} WHERE ${sesiones.usuarioId} = ${usuarios.id})`.mapWith(
            (valor: string | Date | null) => (valor === null ? null : new Date(valor)),
          ),
        controlesHoy:
          sql`(SELECT count(*) FROM ${controles} WHERE ${controles.agenteId} = ${usuarios.id} AND ${controles.municipioId} = ${municipio.id} AND ${gte(controles.creadoEn, desde)})`.mapWith(
            Number,
          ),
      })
      .from(membresias)
      .innerJoin(usuarios, eq(usuarios.id, membresias.usuarioId))
      .where(
        and(
          eq(membresias.municipioId, municipio.id),
          usuarioId ? eq(usuarios.id, usuarioId) : undefined,
        ),
      )
      .orderBy(asc(usuarios.nombre), asc(usuarios.email));

    const porUsuario = new Map<string, (typeof filas)[number]>();
    const prioridad = (fila: (typeof filas)[number]) =>
      (fila.activa ? 2 : 0) + (fila.rol === 'admin' ? 1 : 0);
    for (const fila of filas) {
      const elegida = porUsuario.get(fila.usuarioId);
      if (!elegida || prioridad(fila) > prioridad(elegida)) porUsuario.set(fila.usuarioId, fila);
    }
    return [...porUsuario.values()].map((fila) => ({
      usuarioId: fila.usuarioId,
      email: fila.email,
      nombre: fila.nombre,
      rol: fila.rol,
      activo: fila.activa && fila.usuarioActivo,
      debeCambiarContrasena: fila.debeCambiarContrasena,
      ultimoIngreso: fila.ultimoIngreso?.toISOString() ?? null,
      controlesHoy: fila.controlesHoy,
    }));
  }
}
