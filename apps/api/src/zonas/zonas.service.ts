import { Inject, Injectable } from '@nestjs/common';
import {
  multiPoligonoSchema,
  reglaTarifariaZonaSchema,
  type Cotizacion,
  type CotizacionSolicitud,
  type Ubicacion,
  type ZonaResumen,
  type ZonasGeoJson,
} from '@parkia/contracts';
import {
  estaEnHorarioDeCobro,
  formatearPesos,
  liquidarEstacionamiento,
  type ReglaTarifaria,
} from '@parkia/domain';
import { and, asc, eq, sql } from 'drizzle-orm';

import { NoEncontrado } from '../comun/errores.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { municipios, zonas } from '../db/esquema.js';

interface Municipio {
  readonly id: string;
  readonly zonaHoraria: string;
}

interface FilaZona {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
  readonly reglaTarifaria: unknown;
}

const columnasZona = {
  id: zonas.id,
  nombre: zonas.nombre,
  color: zonas.color,
  reglaTarifaria: zonas.reglaTarifaria,
};

@Injectable()
export class ZonasService {
  constructor(@Inject(CONEXION) private readonly conexion: Conexion) {}

  async listar(slugMunicipio: string, ahora = new Date()): Promise<ZonasGeoJson> {
    const municipio = await this.municipio(slugMunicipio);
    const filas = await this.conexion.db
      .select({ ...columnasZona, geometria: sql<string>`ST_AsGeoJSON(${zonas.area}, 6)` })
      .from(zonas)
      .where(and(eq(zonas.municipioId, municipio.id), eq(zonas.activa, true)))
      .orderBy(asc(zonas.nombre));

    return {
      type: 'FeatureCollection',
      features: filas.map((fila) => {
        const { id, ...propiedades } = this.resumen(fila, municipio, ahora);
        return {
          type: 'Feature',
          id,
          geometry: multiPoligonoSchema.parse(JSON.parse(fila.geometria)),
          properties: propiedades,
        };
      }),
    };
  }

  /** Zona tarifada que contiene la ubicación (incluye el borde). */
  async ubicar(
    slugMunicipio: string,
    ubicacion: Ubicacion,
    ahora = new Date(),
  ): Promise<ZonaResumen> {
    const municipio = await this.municipio(slugMunicipio);
    const punto = sql`ST_SetSRID(ST_MakePoint(${ubicacion.lng}, ${ubicacion.lat}), 4326)`;
    const [fila] = await this.conexion.db
      .select(columnasZona)
      .from(zonas)
      .where(
        and(
          eq(zonas.municipioId, municipio.id),
          eq(zonas.activa, true),
          sql`ST_Covers(${zonas.area}, ${punto})`,
        ),
      )
      .orderBy(asc(zonas.nombre))
      .limit(1);

    if (!fila) {
      throw new NoEncontrado('FUERA_DE_ZONA', 'La ubicación no está dentro de una zona tarifada.');
    }
    return this.resumen(fila, municipio, ahora);
  }

  async cotizar(slugMunicipio: string, solicitud: CotizacionSolicitud): Promise<Cotizacion> {
    const municipio = await this.municipio(slugMunicipio);
    const [fila] = await this.conexion.db
      .select(columnasZona)
      .from(zonas)
      .where(
        and(
          eq(zonas.id, solicitud.zonaId),
          eq(zonas.municipioId, municipio.id),
          eq(zonas.activa, true),
        ),
      )
      .limit(1);

    if (!fila) {
      throw new NoEncontrado('ZONA_NO_ENCONTRADA', 'La zona no existe en este municipio.');
    }

    const liquidacion = liquidarEstacionamiento(this.regla(fila, municipio), solicitud);
    return {
      zonaId: fila.id,
      ...liquidacion,
      importeFormateado: formatearPesos(liquidacion.importe),
      jornadas: [...liquidacion.jornadas],
    };
  }

  private async municipio(slug: string): Promise<Municipio> {
    const [municipio] = await this.conexion.db
      .select({ id: municipios.id, zonaHoraria: municipios.zonaHoraria })
      .from(municipios)
      .where(and(eq(municipios.slug, slug), eq(municipios.activo, true)))
      .limit(1);

    if (!municipio) {
      throw new NoEncontrado('MUNICIPIO_NO_ENCONTRADO', `No existe el municipio "${slug}".`);
    }
    return municipio;
  }

  private regla(fila: FilaZona, municipio: Municipio): ReglaTarifaria {
    return {
      ...reglaTarifariaZonaSchema.parse(fila.reglaTarifaria),
      zonaHoraria: municipio.zonaHoraria,
    };
  }

  private resumen(fila: FilaZona, municipio: Municipio, ahora: Date): ZonaResumen {
    return {
      id: fila.id,
      nombre: fila.nombre,
      color: fila.color,
      enHorarioDeCobro: estaEnHorarioDeCobro(this.regla(fila, municipio), ahora),
    };
  }
}
