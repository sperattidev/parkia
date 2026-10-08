import { Inject, Injectable } from '@nestjs/common';
import {
  lineaSchema,
  reglaTarifariaZonaSchema,
  type Cotizacion,
  type CotizacionSolicitud,
  type Cuadra,
  type LugaresDeMano,
  type Mapa,
  type Ubicacion,
  type UbicacionEnCuadra,
  type ZonaResumen,
} from '@parkia/contracts';
import {
  alturaEnCuadra,
  direccion,
  estaEnHorarioDeCobro,
  formatearPesos,
  liquidarEstacionamiento,
  resumirHorario,
  type Lado,
  type ReglaTarifaria,
} from '@parkia/domain';
import { and, asc, count, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';

import { NoEncontrado } from '../comun/errores.js';
import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { cuadras, estacionamientos, zonas } from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';

/** Distancia máxima entre el GPS y el eje de la calle para considerar que se está en la cuadra. */
export const RADIO_DE_CUADRA_METROS = 25;

/** Zona activa con su regla tarifaria completa (incluida la zona horaria del municipio). */
export interface Zona {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
  readonly regla: ReglaTarifaria;
}

/** Cuadra tarifada (con zona activa) tal como la usan estacionamientos y controles. */
export interface CuadraTarifada {
  readonly id: string;
  readonly calle: string;
  readonly alturaDesde: number;
  readonly alturaHasta: number;
  readonly lugares: Readonly<Record<Lado, number>>;
  readonly lugaresNumerados: boolean;
  readonly zona: Zona;
}

/** Posición de un punto respecto de una cuadra. */
export interface PosicionEnCuadra {
  readonly cuadra: CuadraTarifada;
  readonly lado: Lado;
  readonly altura: number;
  readonly distanciaMetros: number;
}

const columnasZona = {
  id: zonas.id,
  nombre: zonas.nombre,
  color: zonas.color,
  reglaTarifaria: zonas.reglaTarifaria,
};

const columnasCuadra = {
  id: cuadras.id,
  calle: cuadras.calle,
  alturaDesde: cuadras.alturaDesde,
  alturaHasta: cuadras.alturaHasta,
  lugaresPar: cuadras.lugaresPar,
  lugaresImpar: cuadras.lugaresImpar,
  lugaresNumerados: cuadras.lugaresNumerados,
  paresALaDerecha: cuadras.paresALaDerecha,
  zona: columnasZona,
};

interface FilaCuadra {
  id: string;
  calle: string;
  alturaDesde: number;
  alturaHasta: number;
  lugaresPar: number;
  lugaresImpar: number;
  lugaresNumerados: boolean;
  zona: { id: string; nombre: string; color: string; reglaTarifaria: unknown };
}

const punto = (ubicacion: Ubicacion) =>
  sql`ST_SetSRID(ST_MakePoint(${ubicacion.lng}, ${ubicacion.lat}), 4326)`;

@Injectable()
export class ZonasService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly reloj: Reloj,
  ) {}

  /** Zonas y cuadras tarifadas, con su ocupación en este momento. */
  async mapa(slugMunicipio: string): Promise<Mapa> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const filasZonas = await this.conexion.db
      .select(columnasZona)
      .from(zonas)
      .where(and(eq(zonas.municipioId, municipio.id), eq(zonas.activa, true)))
      .orderBy(asc(zonas.nombre));

    const filas = await this.conexion.db
      .select({ ...columnasCuadra, geometria: sql<string>`ST_AsGeoJSON(${cuadras.geometria}, 6)` })
      .from(cuadras)
      .innerJoin(zonas, eq(zonas.id, cuadras.zonaId))
      .where(this.cuadrasTarifadas(municipio))
      .orderBy(asc(cuadras.calle), asc(cuadras.alturaDesde));
    const ocupacion = await this.ocupacion(filas.map((fila) => fila.id));

    return {
      zonas: filasZonas.map((fila) => this.resumen(this.aZona(fila, municipio), ahora)),
      cuadras: {
        type: 'FeatureCollection',
        features: filas.map((fila) => {
          const { id, ...cuadra } = this.aCuadra(this.aCuadraTarifada(fila, municipio), ocupacion);
          return {
            type: 'Feature',
            id,
            geometry: lineaSchema.parse(JSON.parse(fila.geometria)),
            properties: { ...cuadra, color: fila.zona.color },
          };
        }),
      },
    };
  }

  /** Cuadra, mano y altura en una ubicación, o 404 `FUERA_DE_ZONA`. */
  async ubicar(slugMunicipio: string, ubicacion: Ubicacion): Promise<UbicacionEnCuadra> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const posicion = await this.posicionEn(municipio, ubicacion);
    if (!posicion) {
      throw new NoEncontrado(
        'FUERA_DE_ZONA',
        'La ubicación no está sobre una cuadra de estacionamiento medido.',
      );
    }
    const { cuadra, lado, altura, distanciaMetros } = posicion;
    const ocupacion = await this.ocupacion([cuadra.id]);
    return {
      cuadra: this.aCuadra(cuadra, ocupacion),
      zona: this.resumen(cuadra.zona, ahora),
      lado,
      altura,
      direccion: direccion(cuadra.calle, altura),
      distanciaMetros: Math.round(distanciaMetros * 10) / 10,
      lugaresOcupados: cuadra.lugaresNumerados ? await this.lugaresOcupados(cuadra.id, lado) : [],
    };
  }

  async cotizar(slugMunicipio: string, solicitud: CotizacionSolicitud): Promise<Cotizacion> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const zona = await this.porId(municipio, solicitud.zonaId);
    const liquidacion = liquidarEstacionamiento(zona.regla, solicitud);
    return {
      zonaId: zona.id,
      ...liquidacion,
      importeFormateado: formatearPesos(liquidacion.importe),
      jornadas: [...liquidacion.jornadas],
    };
  }

  /** Zona activa del municipio, o 404 `ZONA_NO_ENCONTRADA`. */
  async porId(municipio: Municipio, zonaId: string): Promise<Zona> {
    const [fila] = await this.conexion.db
      .select(columnasZona)
      .from(zonas)
      .where(and(eq(zonas.id, zonaId), eq(zonas.municipioId, municipio.id), eq(zonas.activa, true)))
      .limit(1);
    if (!fila) {
      throw new NoEncontrado('ZONA_NO_ENCONTRADA', 'La zona no existe en este municipio.');
    }
    return this.aZona(fila, municipio);
  }

  /** Cuadra tarifada del municipio, o 404 `CUADRA_NO_ENCONTRADA`. */
  async cuadraPorId(municipio: Municipio, cuadraId: string): Promise<CuadraTarifada> {
    const [fila] = await this.conexion.db
      .select(columnasCuadra)
      .from(cuadras)
      .innerJoin(zonas, eq(zonas.id, cuadras.zonaId))
      .where(and(eq(cuadras.id, cuadraId), this.cuadrasTarifadas(municipio)))
      .limit(1);
    if (!fila) {
      throw new NoEncontrado(
        'CUADRA_NO_ENCONTRADA',
        'La cuadra no existe o no tiene estacionamiento medido.',
      );
    }
    return this.aCuadraTarifada(fila, municipio);
  }

  /**
   * Cuadra tarifada más cercana (a menos de `RADIO_DE_CUADRA_METROS`), la mano
   * según de qué lado del eje está el punto y la altura interpolada.
   */
  async posicionEn(municipio: Municipio, ubicacion: Ubicacion): Promise<PosicionEnCuadra | null> {
    const p = punto(ubicacion);
    const inicio = sql`ST_StartPoint(${cuadras.geometria})`;
    const fin = sql`ST_EndPoint(${cuadras.geometria})`;
    const distancia = sql`ST_Distance(${cuadras.geometria}::geography, ${p}::geography)`.mapWith(
      Number,
    );
    const [fila] = await this.conexion.db
      .select({
        ...columnasCuadra,
        distancia,
        fraccion: sql`ST_LineLocatePoint(${cuadras.geometria}, ${p})`.mapWith(Number),
        // Producto vectorial: positivo si el punto queda a la izquierda del sentido de la numeración.
        cruz: sql`(ST_X(${fin}) - ST_X(${inicio})) * (ST_Y(${p}) - ST_Y(${inicio})) - (ST_Y(${fin}) - ST_Y(${inicio})) * (ST_X(${p}) - ST_X(${inicio}))`.mapWith(
          Number,
        ),
      })
      .from(cuadras)
      .innerJoin(zonas, eq(zonas.id, cuadras.zonaId))
      .where(
        and(
          this.cuadrasTarifadas(municipio),
          sql`ST_DWithin(${cuadras.geometria}::geography, ${p}::geography, ${RADIO_DE_CUADRA_METROS})`,
        ),
      )
      .orderBy(distancia)
      .limit(1);
    if (!fila) return null;

    const aLaDerecha = fila.cruz < 0;
    const lado: Lado = aLaDerecha === fila.paresALaDerecha ? 'par' : 'impar';
    const cuadra = this.aCuadraTarifada(fila, municipio);
    return {
      cuadra,
      lado,
      altura: alturaEnCuadra(cuadra, fila.fraccion, lado),
      distanciaMetros: fila.distancia,
    };
  }

  /** Capacidad y lugares en uso de una mano, para elegir lugar en cuadras numeradas. */
  async lugaresDeMano(slugMunicipio: string, cuadraId: string, lado: Lado): Promise<LugaresDeMano> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const cuadra = await this.cuadraPorId(municipio, cuadraId);
    return {
      cuadraId: cuadra.id,
      lado,
      capacidad: cuadra.lugares[lado],
      ocupados: await this.lugaresOcupados(cuadra.id, lado),
    };
  }

  /** Números de lugar ocupados ahora en una mano de una cuadra. */
  async lugaresOcupados(cuadraId: string, lado: Lado): Promise<number[]> {
    const filas = await this.conexion.db
      .select({ lugar: estacionamientos.lugar })
      .from(estacionamientos)
      .where(
        and(
          eq(estacionamientos.cuadraId, cuadraId),
          eq(estacionamientos.lado, lado),
          eq(estacionamientos.estado, 'activo'),
          isNotNull(estacionamientos.lugar),
        ),
      );
    return filas.flatMap((fila) => (fila.lugar === null ? [] : [fila.lugar])).sort((a, b) => a - b);
  }

  resumen(zona: Zona, ahora: Date): ZonaResumen {
    return {
      id: zona.id,
      nombre: zona.nombre,
      color: zona.color,
      enHorarioDeCobro: estaEnHorarioDeCobro(zona.regla, ahora),
      tarifa: {
        precioHora: zona.regla.tramos[0]?.precioHora ?? 0,
        horario: resumirHorario(zona.regla.horario),
      },
    };
  }

  private cuadrasTarifadas(municipio: Municipio): SQL | undefined {
    return and(
      eq(cuadras.municipioId, municipio.id),
      eq(cuadras.activa, true),
      eq(zonas.activa, true),
    );
  }

  /** Estacionamientos en curso por cuadra y mano. */
  private async ocupacion(ids: readonly string[]): Promise<Map<string, Record<Lado, number>>> {
    const resultado = new Map<string, Record<Lado, number>>();
    if (ids.length === 0) return resultado;
    const filas = await this.conexion.db
      .select({ cuadraId: estacionamientos.cuadraId, lado: estacionamientos.lado, total: count() })
      .from(estacionamientos)
      .where(
        and(inArray(estacionamientos.cuadraId, [...ids]), eq(estacionamientos.estado, 'activo')),
      )
      .groupBy(estacionamientos.cuadraId, estacionamientos.lado);
    for (const { cuadraId, lado, total } of filas) {
      if (!cuadraId || !lado) continue;
      const actual = resultado.get(cuadraId) ?? { par: 0, impar: 0 };
      actual[lado] = total;
      resultado.set(cuadraId, actual);
    }
    return resultado;
  }

  private aZona(
    fila: { id: string; nombre: string; color: string; reglaTarifaria: unknown },
    municipio: Municipio,
  ): Zona {
    return {
      id: fila.id,
      nombre: fila.nombre,
      color: fila.color,
      regla: {
        ...reglaTarifariaZonaSchema.parse(fila.reglaTarifaria),
        zonaHoraria: municipio.zonaHoraria,
      },
    };
  }

  private aCuadraTarifada(fila: FilaCuadra, municipio: Municipio): CuadraTarifada {
    return {
      id: fila.id,
      calle: fila.calle,
      alturaDesde: fila.alturaDesde,
      alturaHasta: fila.alturaHasta,
      lugares: { par: fila.lugaresPar, impar: fila.lugaresImpar },
      lugaresNumerados: fila.lugaresNumerados,
      zona: this.aZona(fila.zona, municipio),
    };
  }

  private aCuadra(cuadra: CuadraTarifada, ocupacion: Map<string, Record<Lado, number>>): Cuadra {
    return {
      id: cuadra.id,
      zonaId: cuadra.zona.id,
      calle: cuadra.calle,
      alturaDesde: cuadra.alturaDesde,
      alturaHasta: cuadra.alturaHasta,
      lugaresNumerados: cuadra.lugaresNumerados,
      lugares: { ...cuadra.lugares },
      ocupados: ocupacion.get(cuadra.id) ?? { par: 0, impar: 0 },
    };
  }
}
