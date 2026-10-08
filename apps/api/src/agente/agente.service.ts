import { Inject, Injectable } from '@nestjs/common';
import type {
  AvisoDelRadar,
  ControlBreve,
  Jornada,
  Padron,
  Radar,
  ResultadoDeControl,
  Ubicacion,
  VehiculoDelPadron,
} from '@parkia/contracts';
import {
  MINUTOS_DE_VENCIDOS_RECIENTES,
  MINUTOS_POR_VENCER,
  inicioDelDia,
  situacion,
  type Lado,
} from '@parkia/domain';
import { and, count, desc, eq, gte, isNotNull, max, or, sql, type SQL } from 'drizzle-orm';

import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { controles, cuadras, estacionamientos, zonas } from '../db/esquema.js';
import { ubicacionDe } from '../estacionamientos/ubicacion.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { punto, ZonasService } from '../zonas/zonas.service.js';

/** Resultados que el agente debe atender: el vehículo no puede estar ahí. */
const INFRACCIONES: readonly ResultadoDeControl[] = ['sin_estacionamiento', 'vencido', 'otra_zona'];

const RESULTADOS: readonly ResultadoDeControl[] = [
  'habilitado',
  'fuera_de_horario',
  ...INFRACCIONES,
  'fuera_de_zona',
];

const LIMITE_DEL_RADAR = 50;

/**
 * Columna del estacionamiento de la consulta principal, calificada con la
 * tabla: drizzle la omite cuando hay una sola y las subconsultas la necesitan.
 */
const del = (columna: 'municipio_id' | 'patente' | 'inicio') =>
  sql.raw(`"estacionamientos"."${columna}"`);

/**
 * Herramientas de la ronda del agente. Todo se apoya en lo que el conductor
 * declaró al estacionar (cuadra, mano, altura y lugar): el agente compara esa
 * lista con lo que ve en la calle en vez de tipear patente por patente.
 */
@Injectable()
export class AgenteService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly zonas: ZonasService,
    private readonly reloj: Reloj,
  ) {}

  /** Vehículos declarados en la cuadra, por mano: en curso y vencidos recientes. */
  async padron(slugMunicipio: string, cuadraId: string): Promise<Padron> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const cuadra = await this.zonas.cuadraPorId(municipio, cuadraId);

    const filas = await this.conexion.db
      .select({
        id: estacionamientos.id,
        patente: estacionamientos.patente,
        lado: estacionamientos.lado,
        altura: estacionamientos.altura,
        lugar: estacionamientos.lugar,
        inicio: estacionamientos.inicio,
        venceEn: estacionamientos.venceEn,
        controladoEn: this.ultimoControlDeLaPatente(municipio),
      })
      .from(estacionamientos)
      .where(and(eq(estacionamientos.cuadraId, cuadra.id), this.relevantes(municipio, ahora)))
      .orderBy(estacionamientos.lugar, estacionamientos.altura);

    const [ultimo] = await this.conexion.db
      .select({ creadoEn: max(controles.creadoEn) })
      .from(controles)
      .where(
        and(
          eq(controles.cuadraId, cuadra.id),
          gte(controles.creadoEn, inicioDelDia(ahora, municipio.zonaHoraria)),
        ),
      );

    const mano = (lado: Lado) => ({
      capacidad: cuadra.lugares[lado],
      vehiculos: filas
        .filter((fila) => fila.lado === lado)
        .map((fila): VehiculoDelPadron => ({
          estacionamientoId: fila.id,
          patente: fila.patente,
          altura: fila.altura ?? cuadra.alturaDesde,
          lugar: fila.lugar,
          inicio: fila.inicio.toISOString(),
          venceEn: fila.venceEn.toISOString(),
          situacion: situacion(fila.venceEn, ahora),
          controladoEn: fila.controladoEn?.toISOString() ?? null,
        })),
    });

    const ocupados = {
      par: filas.filter((f) => f.lado === 'par' && f.venceEn > ahora).length,
      impar: filas.filter((f) => f.lado === 'impar' && f.venceEn > ahora).length,
    };
    return {
      cuadra: {
        id: cuadra.id,
        zonaId: cuadra.zona.id,
        calle: cuadra.calle,
        alturaDesde: cuadra.alturaDesde,
        alturaHasta: cuadra.alturaHasta,
        lugaresNumerados: cuadra.lugaresNumerados,
        lugares: { ...cuadra.lugares },
        ocupados,
      },
      zona: this.zonas.resumen(cuadra.zona, ahora),
      manos: { par: mano('par'), impar: mano('impar') },
      ultimoControl: ultimo?.creadoEn?.toISOString() ?? null,
    };
  }

  /**
   * Vencidos recientes y por vencer del municipio, los más cercanos primero.
   * Los vencidos que nadie controló desde que vencieron van adelante: son
   * los que el agente tiene que ir a ver.
   */
  async radar(slugMunicipio: string, ubicacion: Ubicacion | undefined): Promise<Radar> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);

    // Punto aproximado del vehículo sobre el eje de la calle, según su altura.
    const fraccion = sql`LEAST(GREATEST((${estacionamientos.altura} - ${cuadras.alturaDesde})::float / NULLIF(${cuadras.alturaHasta} - ${cuadras.alturaDesde}, 0), 0), 1)`;
    const posicion = sql`ST_LineInterpolatePoint(${cuadras.geometria}, COALESCE(${fraccion}, 0.5))`;
    const distancia = ubicacion
      ? sql`ST_Distance(${posicion}::geography, ${punto(ubicacion)}::geography)`.mapWith(Number)
      : sql`NULL::float`.mapWith(Number);

    const filas = await this.conexion.db
      .select({
        id: estacionamientos.id,
        patente: estacionamientos.patente,
        venceEn: estacionamientos.venceEn,
        cuadraId: estacionamientos.cuadraId,
        lado: estacionamientos.lado,
        altura: estacionamientos.altura,
        lugar: estacionamientos.lugar,
        calle: cuadras.calle,
        zonaId: zonas.id,
        zonaNombre: zonas.nombre,
        zonaColor: zonas.color,
        lng: sql`ST_X(${posicion})`.mapWith(Number),
        lat: sql`ST_Y(${posicion})`.mapWith(Number),
        distanciaMetros: distancia,
        controladoEn: this.ultimoControlDeLaPatente(municipio),
      })
      .from(estacionamientos)
      .innerJoin(cuadras, eq(cuadras.id, estacionamientos.cuadraId))
      .innerJoin(zonas, eq(zonas.id, estacionamientos.zonaId))
      .where(
        and(
          this.relevantes(municipio, ahora),
          sql`${estacionamientos.venceEn} < ${new Date(ahora.getTime() + MINUTOS_POR_VENCER * 60_000)}`,
        ),
      )
      .orderBy(sql`${distancia} NULLS LAST`, desc(estacionamientos.venceEn))
      .limit(LIMITE_DEL_RADAR * 2);

    const avisos = filas.flatMap((fila): AvisoDelRadar[] => {
      const ubicacionDeclarada = ubicacionDe(fila, fila.calle);
      if (!ubicacionDeclarada) return [];
      return [
        {
          estacionamientoId: fila.id,
          patente: fila.patente,
          zona: { id: fila.zonaId, nombre: fila.zonaNombre, color: fila.zonaColor },
          ubicacion: ubicacionDeclarada,
          posicion: [fila.lng, fila.lat],
          venceEn: fila.venceEn.toISOString(),
          situacion: situacion(fila.venceEn, ahora),
          distanciaMetros: ubicacion ? Math.round(fila.distanciaMetros) : null,
          controladoEn: fila.controladoEn?.toISOString() ?? null,
        },
      ];
    });

    // Controlado después de vencer: ya se atendió, va al final.
    const atendido = (aviso: AvisoDelRadar) =>
      aviso.controladoEn !== null && aviso.controladoEn >= aviso.venceEn ? 1 : 0;
    const vencidos = avisos
      .filter((aviso) => aviso.situacion === 'vencido')
      .sort((a, b) => atendido(a) - atendido(b))
      .slice(0, LIMITE_DEL_RADAR);
    const porVencer = avisos
      .filter((aviso) => aviso.situacion === 'por_vencer')
      .sort((a, b) => a.venceEn.localeCompare(b.venceEn))
      .slice(0, LIMITE_DEL_RADAR);
    return { vencidos, porVencer };
  }

  /** Resumen del día del agente y cuadras controladas por todo el equipo. */
  async jornada(agenteId: string, slugMunicipio: string): Promise<Jornada> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const desde = inicioDelDia(ahora, municipio.zonaHoraria);
    const delDia = and(eq(controles.municipioId, municipio.id), gte(controles.creadoEn, desde));
    const delAgente = and(delDia, eq(controles.agenteId, agenteId));

    const [porResultado, ultimos, cobertura] = await Promise.all([
      this.conexion.db
        .select({ resultado: controles.resultado, total: count() })
        .from(controles)
        .where(delAgente)
        .groupBy(controles.resultado),
      this.conexion.db
        .select({
          id: controles.id,
          patente: controles.patente,
          resultado: controles.resultado,
          calle: cuadras.calle,
          creadoEn: controles.creadoEn,
        })
        .from(controles)
        .leftJoin(cuadras, eq(cuadras.id, controles.cuadraId))
        .where(delAgente)
        .orderBy(desc(controles.creadoEn))
        .limit(20),
      this.conexion.db
        .select({
          cuadraId: controles.cuadraId,
          controles: count(),
          ultimoControl: max(controles.creadoEn),
        })
        .from(controles)
        .where(and(delDia, isNotNull(controles.cuadraId)))
        .groupBy(controles.cuadraId),
    ]);

    const totales = Object.fromEntries(RESULTADOS.map((resultado) => [resultado, 0])) as Record<
      ResultadoDeControl,
      number
    >;
    for (const { resultado, total } of porResultado) totales[resultado] = total;

    return {
      desde: desde.toISOString(),
      controles: Object.values(totales).reduce((suma, total) => suma + total, 0),
      infracciones: INFRACCIONES.reduce((suma, resultado) => suma + totales[resultado], 0),
      porResultado: totales,
      ultimos: ultimos.map((fila): ControlBreve => ({
        id: fila.id,
        patente: fila.patente,
        resultado: fila.resultado,
        habilitado: fila.resultado === 'habilitado' || fila.resultado === 'fuera_de_horario',
        calle: fila.calle,
        registradoEn: fila.creadoEn.toISOString(),
      })),
      cobertura: cobertura.flatMap((fila) =>
        fila.cuadraId && fila.ultimoControl
          ? [
              {
                cuadraId: fila.cuadraId,
                controles: fila.controles,
                ultimoControl: fila.ultimoControl.toISOString(),
              },
            ]
          : [],
      ),
    };
  }

  /**
   * Estacionamientos que importan al agente: los que están en curso y los que
   * se cerraron por saldo agotado hace poco, salvo que la patente haya vuelto
   * a estacionar (entonces manda el nuevo).
   */
  private relevantes(municipio: Municipio, ahora: Date): SQL | undefined {
    const desde = new Date(ahora.getTime() - MINUTOS_DE_VENCIDOS_RECIENTES * 60_000);
    return and(
      eq(estacionamientos.municipioId, municipio.id),
      or(
        eq(estacionamientos.estado, 'activo'),
        and(
          eq(estacionamientos.motivoDeCierre, 'saldo_agotado'),
          gte(estacionamientos.fin, desde),
          sql`NOT EXISTS (SELECT 1 FROM estacionamientos AS posterior WHERE posterior.municipio_id = ${del('municipio_id')} AND posterior.patente = ${del('patente')} AND posterior.inicio > ${del('inicio')})`,
        ),
      ),
    );
  }

  /** Último control de la patente desde que empezó el estacionamiento. */
  private ultimoControlDeLaPatente(municipio: Municipio) {
    return sql<Date | null>`(SELECT max(control.creado_en) FROM controles AS control WHERE control.municipio_id = ${municipio.id} AND control.patente = ${del('patente')} AND control.creado_en >= ${del('inicio')})`.mapWith(
      (valor: string | Date | null) => (valor === null ? null : new Date(valor)),
    );
  }
}
