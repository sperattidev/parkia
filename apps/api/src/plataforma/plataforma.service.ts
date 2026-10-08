import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AltaDeMunicipio, MunicipioDePlataforma } from '@parkia/contracts';
import { inicioDelDia } from '@parkia/domain';
import { and, asc, count, eq, gte, isNull, sql } from 'drizzle-orm';

import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { ErrorDeApi, NoEncontrado } from '../comun/errores.js';
import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { estacionamientos, municipios, usuarios } from '../db/esquema.js';
import { registrarAuditoria } from '../gestion/auditoria.js';
import { PersonalService } from '../gestion/personal.service.js';

const DIA_MS = 86_400_000;

/** Calificado a mano: en una consulta de una sola tabla drizzle omite el nombre de la tabla. */
const idDelMunicipio = sql.raw('"municipios"."id"');

export interface MunicipioNuevo {
  readonly slug: string;
  readonly nombre: string;
  readonly provincia: string;
  readonly zonaHoraria: string;
  readonly administrador: { readonly email: string; readonly nombre: string };
}

/** Herramientas del equipo de Parkia: alta y estado de los municipios clientes. */
@Injectable()
export class PlataformaService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly personal: PersonalService,
    private readonly reloj: Reloj,
  ) {}

  /** Todos los municipios (también los inactivos) con sus indicadores principales. */
  async municipios(slug?: string): Promise<MunicipioDePlataforma[]> {
    const ahora = this.reloj.ahora();
    const hace30Dias = new Date(ahora.getTime() - 30 * DIA_MS);
    const filas = await this.conexion.db
      .select({
        slug: municipios.slug,
        nombre: municipios.nombre,
        provincia: municipios.provincia,
        zonaHoraria: municipios.zonaHoraria,
        activo: municipios.activo,
        zonas:
          sql`(SELECT count(*) FROM zonas z WHERE z.municipio_id = ${idDelMunicipio} AND z.activa)`.mapWith(
            Number,
          ),
        cuadras:
          sql`(SELECT count(*) FROM cuadras c WHERE c.municipio_id = ${idDelMunicipio} AND c.activa AND c.zona_id IS NOT NULL)`.mapWith(
            Number,
          ),
        personal:
          sql`(SELECT count(DISTINCT m.usuario_id) FROM membresias m WHERE m.municipio_id = ${idDelMunicipio} AND m.activa)`.mapWith(
            Number,
          ),
        recaudado30Dias:
          sql`(SELECT coalesce(sum(e.importe), 0) FROM estacionamientos e WHERE e.municipio_id = ${idDelMunicipio} AND e.estado = 'finalizado' AND e.fin >= ${hace30Dias})`.mapWith(
            Number,
          ),
      })
      .from(municipios)
      .where(slug ? eq(municipios.slug, slug) : undefined)
      .orderBy(asc(municipios.nombre));

    // «Hoy» depende de la zona horaria de cada municipio.
    return Promise.all(
      filas.map(async (fila) => {
        const desde = inicioDelDia(ahora, fila.zonaHoraria);
        const [hoy] = await this.conexion.db
          .select({ total: count() })
          .from(estacionamientos)
          .innerJoin(municipios, eq(municipios.id, estacionamientos.municipioId))
          .where(and(eq(municipios.slug, fila.slug), gte(estacionamientos.inicio, desde)));
        return { ...fila, estacionamientosHoy: hoy?.total ?? 0 };
      }),
    );
  }

  /** Da de alta un municipio y su primer administrador, que recibe una contraseña temporal. */
  async crear(autor: UsuarioAutenticado, nuevo: MunicipioNuevo): Promise<AltaDeMunicipio> {
    try {
      new Intl.DateTimeFormat('es-AR', { timeZone: nuevo.zonaHoraria });
    } catch {
      throw new ErrorDeApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ZONA_HORARIA_INVALIDA',
        `Zona horaria desconocida: "${nuevo.zonaHoraria}".`,
      );
    }
    const [existente] = await this.conexion.db
      .select({ id: municipios.id })
      .from(municipios)
      .where(eq(municipios.slug, nuevo.slug));
    if (existente) {
      throw new ErrorDeApi(
        HttpStatus.CONFLICT,
        'MUNICIPIO_EXISTENTE',
        `Ya existe un municipio con el identificador "${nuevo.slug}".`,
      );
    }
    // Se valida antes de crear el municipio para no dejarlo sin administrador.
    const [conductor] = await this.conexion.db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.email, nuevo.administrador.email), isNull(usuarios.hashContrasena)));
    if (conductor) {
      throw new ErrorDeApi(
        HttpStatus.CONFLICT,
        'EMAIL_DE_CONDUCTOR',
        'El email del administrador ya está registrado como conductor. Usá un email institucional.',
      );
    }

    await this.conexion.db.transaction(async (tx) => {
      const [creado] = await tx
        .insert(municipios)
        .values({
          slug: nuevo.slug,
          nombre: nuevo.nombre,
          provincia: nuevo.provincia,
          zonaHoraria: nuevo.zonaHoraria,
        })
        .returning({ id: municipios.id });
      if (!creado) throw new Error('No se pudo crear el municipio.');
      await registrarAuditoria(tx, {
        municipioId: creado.id,
        usuarioId: autor.id,
        accion: 'municipio.alta',
        entidad: 'municipio',
        entidadId: creado.id,
        despues: { slug: nuevo.slug, nombre: nuevo.nombre, provincia: nuevo.provincia },
      });
    });
    const administrador = await this.personal.alta(autor, nuevo.slug, {
      ...nuevo.administrador,
      rol: 'admin',
    });
    return { municipio: await this.municipio(nuevo.slug), administrador };
  }

  /** Cambia los datos de un municipio o lo desactiva (deja de verse y de operar). */
  async cambiar(
    autor: UsuarioAutenticado,
    slug: string,
    cambio: {
      nombre?: string | undefined;
      provincia?: string | undefined;
      activo?: boolean | undefined;
    },
  ): Promise<MunicipioDePlataforma> {
    const [actual] = await this.conexion.db
      .select({
        id: municipios.id,
        nombre: municipios.nombre,
        provincia: municipios.provincia,
        activo: municipios.activo,
      })
      .from(municipios)
      .where(eq(municipios.slug, slug));
    if (!actual) {
      throw new NoEncontrado('MUNICIPIO_NO_ENCONTRADO', `No existe el municipio "${slug}".`);
    }
    const valores = Object.fromEntries(
      Object.entries(cambio).filter(([, valor]) => valor !== undefined),
    );
    if (Object.keys(valores).length > 0) {
      await this.conexion.db.transaction(async (tx) => {
        await tx.update(municipios).set(valores).where(eq(municipios.id, actual.id));
        await registrarAuditoria(tx, {
          municipioId: actual.id,
          usuarioId: autor.id,
          accion: 'municipio.cambio',
          entidad: 'municipio',
          entidadId: actual.id,
          antes: Object.fromEntries(
            Object.keys(valores).map((clave) => [clave, actual[clave as keyof typeof actual]]),
          ),
          despues: valores,
        });
      });
    }
    return this.municipio(slug);
  }

  private async municipio(slug: string): Promise<MunicipioDePlataforma> {
    const [municipio] = await this.municipios(slug);
    if (!municipio) {
      throw new NoEncontrado('MUNICIPIO_NO_ENCONTRADO', `No existe el municipio "${slug}".`);
    }
    return municipio;
  }
}
