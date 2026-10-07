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
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';

import { NoEncontrado } from '../comun/errores.js';
import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { zonas } from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';

/** Zona activa con su regla tarifaria completa (incluida la zona horaria del municipio). */
export interface Zona {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
  readonly regla: ReglaTarifaria;
}

const columnasZona = {
  id: zonas.id,
  nombre: zonas.nombre,
  color: zonas.color,
  reglaTarifaria: zonas.reglaTarifaria,
};

@Injectable()
export class ZonasService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly reloj: Reloj,
  ) {}

  async listar(slugMunicipio: string): Promise<ZonasGeoJson> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const filas = await this.conexion.db
      .select({ ...columnasZona, geometria: sql<string>`ST_AsGeoJSON(${zonas.area}, 6)` })
      .from(zonas)
      .where(and(eq(zonas.municipioId, municipio.id), eq(zonas.activa, true)))
      .orderBy(asc(zonas.nombre));

    return {
      type: 'FeatureCollection',
      features: filas.map((fila) => {
        const { id, ...propiedades } = this.resumen(this.aZona(fila, municipio), ahora);
        return {
          type: 'Feature',
          id,
          geometry: multiPoligonoSchema.parse(JSON.parse(fila.geometria)),
          properties: propiedades,
        };
      }),
    };
  }

  async ubicar(slugMunicipio: string, ubicacion: Ubicacion): Promise<ZonaResumen> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    return this.resumen(await this.enUbicacion(municipio, ubicacion), ahora);
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
    const zona = await this.buscar(municipio, eq(zonas.id, zonaId));
    if (!zona) {
      throw new NoEncontrado('ZONA_NO_ENCONTRADA', 'La zona no existe en este municipio.');
    }
    return zona;
  }

  /** Zona tarifada que contiene la ubicación (incluye el borde), o 404 `FUERA_DE_ZONA`. */
  async enUbicacion(municipio: Municipio, ubicacion: Ubicacion): Promise<Zona> {
    const punto = sql`ST_SetSRID(ST_MakePoint(${ubicacion.lng}, ${ubicacion.lat}), 4326)`;
    const zona = await this.buscar(municipio, sql`ST_Covers(${zonas.area}, ${punto})`);
    if (!zona) {
      throw new NoEncontrado('FUERA_DE_ZONA', 'La ubicación no está dentro de una zona tarifada.');
    }
    return zona;
  }

  private async buscar(municipio: Municipio, condicion: SQL): Promise<Zona | undefined> {
    const [fila] = await this.conexion.db
      .select(columnasZona)
      .from(zonas)
      .where(and(eq(zonas.municipioId, municipio.id), eq(zonas.activa, true), condicion))
      .orderBy(asc(zonas.nombre))
      .limit(1);
    return fila && this.aZona(fila, municipio);
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

  private resumen(zona: Zona, ahora: Date): ZonaResumen {
    return {
      id: zona.id,
      nombre: zona.nombre,
      color: zona.color,
      enHorarioDeCobro: estaEnHorarioDeCobro(zona.regla, ahora),
    };
  }
}
