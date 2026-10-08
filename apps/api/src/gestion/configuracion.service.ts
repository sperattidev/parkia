import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  lineaSchema,
  reglaTarifariaZonaSchema,
  type CuadrasDeGestion,
  type ReglaTarifariaZonaEntrada,
  type ZonaDeGestion,
} from '@parkia/contracts';
import type { Lado } from '@parkia/domain';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';

import { ErrorDeApi, NoEncontrado } from '../comun/errores.js';
import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { cuadras, estacionamientos, zonas } from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { ZonasService } from '../zonas/zonas.service.js';
import { registrarAuditoria } from './auditoria.js';

/** Color de las cuadras que no pertenecen a ninguna zona en el mapa de gestión. */
const COLOR_SIN_ZONA = '#8A97AB';

export interface CambioDeZona {
  readonly nombre?: string | undefined;
  readonly color?: string | undefined;
  readonly activa?: boolean | undefined;
  readonly regla?: ReglaTarifariaZonaEntrada | undefined;
}

export interface CambioDeCuadra {
  readonly zonaId?: string | null | undefined;
  readonly lugaresPar?: number | undefined;
  readonly lugaresImpar?: number | undefined;
  readonly lugaresNumerados?: boolean | undefined;
  readonly activa?: boolean | undefined;
}

/** Quita las claves sin valor: lo que se audita es exactamente lo que cambió. */
function definidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined),
  ) as Partial<T>;
}

@Injectable()
export class ConfiguracionService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly zonasPublicas: ZonasService,
    private readonly reloj: Reloj,
  ) {}

  // ─── Zonas y tarifas ───────────────────────────────────────────────────────

  async zonas(slugMunicipio: string): Promise<ZonaDeGestion[]> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const [filas, totales] = await Promise.all([
      this.conexion.db
        .select()
        .from(zonas)
        .where(eq(zonas.municipioId, municipio.id))
        .orderBy(asc(zonas.nombre)),
      this.conexion.db
        .select({
          zonaId: cuadras.zonaId,
          cuadras: count(),
          capacidad: sql`coalesce(sum(${cuadras.lugaresPar} + ${cuadras.lugaresImpar}), 0)`.mapWith(
            Number,
          ),
        })
        .from(cuadras)
        .where(and(eq(cuadras.municipioId, municipio.id), eq(cuadras.activa, true)))
        .groupBy(cuadras.zonaId),
    ]);
    const porZona = new Map(totales.map((fila) => [fila.zonaId, fila]));
    const ahora = this.reloj.ahora();
    return filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      color: fila.color,
      activa: fila.activa,
      regla: fila.reglaTarifaria,
      resumen: this.zonasPublicas.resumen(
        {
          id: fila.id,
          nombre: fila.nombre,
          color: fila.color,
          regla: {
            ...reglaTarifariaZonaSchema.parse(fila.reglaTarifaria),
            zonaHoraria: municipio.zonaHoraria,
          },
        },
        ahora,
      ),
      cuadras: porZona.get(fila.id)?.cuadras ?? 0,
      capacidad: porZona.get(fila.id)?.capacidad ?? 0,
    }));
  }

  async crearZona(
    usuarioId: string,
    slugMunicipio: string,
    zona: { nombre: string; color: string; regla: ReglaTarifariaZonaEntrada },
  ): Promise<ZonaDeGestion> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    await this.exigirNombreLibre(municipio, zona.nombre);
    const id = await this.conexion.db.transaction(async (tx) => {
      const [creada] = await tx
        .insert(zonas)
        .values({
          municipioId: municipio.id,
          nombre: zona.nombre,
          color: zona.color.toUpperCase(),
          reglaTarifaria: zona.regla,
        })
        .returning({ id: zonas.id });
      if (!creada) throw new Error('No se pudo crear la zona.');
      await registrarAuditoria(tx, {
        municipioId: municipio.id,
        usuarioId,
        accion: 'zona.alta',
        entidad: 'zona',
        entidadId: creada.id,
        despues: zona,
      });
      return creada.id;
    });
    return this.zonaPorId(slugMunicipio, id);
  }

  /**
   * Cambia nombre, color, estado o tarifa. Los estacionamientos en curso no se
   * ven afectados: conservan la tarifa con la que empezaron.
   */
  async cambiarZona(
    usuarioId: string,
    slugMunicipio: string,
    zonaId: string,
    cambio: CambioDeZona,
  ): Promise<ZonaDeGestion> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const actual = await this.filaDeZona(municipio, zonaId);
    if (cambio.nombre && cambio.nombre !== actual.nombre) {
      await this.exigirNombreLibre(municipio, cambio.nombre, zonaId);
    }
    const valores = definidos({
      nombre: cambio.nombre,
      color: cambio.color?.toUpperCase(),
      activa: cambio.activa,
      reglaTarifaria: cambio.regla,
    });
    if (Object.keys(valores).length > 0) {
      await this.conexion.db.transaction(async (tx) => {
        await tx.update(zonas).set(valores).where(eq(zonas.id, zonaId));
        const antes = Object.fromEntries(
          Object.keys(valores).map((clave) => [clave, actual[clave as keyof typeof actual]]),
        );
        await registrarAuditoria(tx, {
          municipioId: municipio.id,
          usuarioId,
          accion: cambio.regla ? 'zona.tarifa' : 'zona.cambio',
          entidad: 'zona',
          entidadId: zonaId,
          antes,
          despues: valores,
        });
      });
    }
    return this.zonaPorId(slugMunicipio, zonaId);
  }

  private async zonaPorId(slugMunicipio: string, zonaId: string): Promise<ZonaDeGestion> {
    const zona = (await this.zonas(slugMunicipio)).find((z) => z.id === zonaId);
    if (!zona) throw new NoEncontrado('ZONA_NO_ENCONTRADA', 'La zona no existe en este municipio.');
    return zona;
  }

  private async filaDeZona(municipio: Municipio, zonaId: string) {
    const [fila] = await this.conexion.db
      .select()
      .from(zonas)
      .where(and(eq(zonas.id, zonaId), eq(zonas.municipioId, municipio.id)));
    if (!fila) throw new NoEncontrado('ZONA_NO_ENCONTRADA', 'La zona no existe en este municipio.');
    return fila;
  }

  private async exigirNombreLibre(municipio: Municipio, nombre: string, excepto?: string) {
    const [repetida] = await this.conexion.db
      .select({ id: zonas.id })
      .from(zonas)
      .where(
        and(
          eq(zonas.municipioId, municipio.id),
          sql`lower(${zonas.nombre}) = lower(${nombre})`,
          excepto ? ne(zonas.id, excepto) : undefined,
        ),
      );
    if (repetida) {
      throw new ErrorDeApi(
        HttpStatus.CONFLICT,
        'ZONA_EXISTENTE',
        `Ya existe una zona llamada "${nombre}".`,
      );
    }
  }

  // ─── Cuadras ───────────────────────────────────────────────────────────────

  /** Todas las cuadras del municipio (también las que no están en ninguna zona). */
  async cuadras(slugMunicipio: string): Promise<CuadrasDeGestion> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const [filas, ocupacion] = await Promise.all([
      this.conexion.db
        .select({
          id: cuadras.id,
          zonaId: cuadras.zonaId,
          calle: cuadras.calle,
          alturaDesde: cuadras.alturaDesde,
          alturaHasta: cuadras.alturaHasta,
          lugaresPar: cuadras.lugaresPar,
          lugaresImpar: cuadras.lugaresImpar,
          lugaresNumerados: cuadras.lugaresNumerados,
          activa: cuadras.activa,
          color: zonas.color,
          geometria: sql<string>`ST_AsGeoJSON(${cuadras.geometria}, 6)`,
        })
        .from(cuadras)
        .leftJoin(zonas, eq(zonas.id, cuadras.zonaId))
        .where(eq(cuadras.municipioId, municipio.id))
        .orderBy(asc(cuadras.calle), asc(cuadras.alturaDesde)),
      this.conexion.db
        .select({
          cuadraId: estacionamientos.cuadraId,
          lado: estacionamientos.lado,
          total: count(),
        })
        .from(estacionamientos)
        .where(
          and(
            eq(estacionamientos.municipioId, municipio.id),
            eq(estacionamientos.estado, 'activo'),
          ),
        )
        .groupBy(estacionamientos.cuadraId, estacionamientos.lado),
    ]);
    const ocupados = new Map<string, Record<Lado, number>>();
    for (const { cuadraId, lado, total } of ocupacion) {
      if (!cuadraId || !lado) continue;
      const actual = ocupados.get(cuadraId) ?? { par: 0, impar: 0 };
      actual[lado] = total;
      ocupados.set(cuadraId, actual);
    }
    return {
      type: 'FeatureCollection',
      features: filas.map((fila) => ({
        type: 'Feature',
        id: fila.id,
        geometry: lineaSchema.parse(JSON.parse(fila.geometria)),
        properties: {
          zonaId: fila.zonaId,
          calle: fila.calle,
          alturaDesde: fila.alturaDesde,
          alturaHasta: fila.alturaHasta,
          lugares: { par: fila.lugaresPar, impar: fila.lugaresImpar },
          lugaresNumerados: fila.lugaresNumerados,
          activa: fila.activa,
          color: fila.zonaId && fila.color ? fila.color : COLOR_SIN_ZONA,
          ocupados: ocupados.get(fila.id) ?? { par: 0, impar: 0 },
        },
      })),
    };
  }

  /**
   * Asigna la cuadra a una zona (o la saca de todas), cambia su capacidad o la
   * activa. Así se arma una zona: tocando las cuadras de sus manzanas.
   */
  async cambiarCuadra(
    usuarioId: string,
    slugMunicipio: string,
    cuadraId: string,
    cambio: CambioDeCuadra,
  ): Promise<void> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const [actual] = await this.conexion.db
      .select({
        zonaId: cuadras.zonaId,
        lugaresPar: cuadras.lugaresPar,
        lugaresImpar: cuadras.lugaresImpar,
        lugaresNumerados: cuadras.lugaresNumerados,
        activa: cuadras.activa,
      })
      .from(cuadras)
      .where(and(eq(cuadras.id, cuadraId), eq(cuadras.municipioId, municipio.id)));
    if (!actual) {
      throw new NoEncontrado('CUADRA_NO_ENCONTRADA', 'La cuadra no existe en este municipio.');
    }
    if (cambio.zonaId) await this.filaDeZona(municipio, cambio.zonaId);

    const valores = definidos(cambio);
    if (Object.keys(valores).length === 0) return;
    await this.conexion.db.transaction(async (tx) => {
      await tx.update(cuadras).set(valores).where(eq(cuadras.id, cuadraId));
      await registrarAuditoria(tx, {
        municipioId: municipio.id,
        usuarioId,
        accion: 'cuadra.cambio',
        entidad: 'cuadra',
        entidadId: cuadraId,
        antes: Object.fromEntries(
          Object.keys(valores).map((clave) => [clave, actual[clave as keyof typeof actual]]),
        ),
        despues: valores,
      });
    });
  }
}
