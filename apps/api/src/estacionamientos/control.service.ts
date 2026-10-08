import { Inject, Injectable } from '@nestjs/common';
import type { Control, ResultadoDeControl } from '@parkia/contracts';
import {
  coincidencia,
  estaEnHorarioDeCobro,
  evaluarControl,
  inicioDelDia,
  type Patente,
} from '@parkia/domain';
import { and, desc, eq, gte, or, sql } from 'drizzle-orm';

import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { controles, cuadras, estacionamientos, zonas } from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { RADIO_DE_CONTROL_METROS, ZonasService } from '../zonas/zonas.service.js';
import { ubicacionDe } from './ubicacion.js';

export interface SolicitudDeControl {
  readonly patente: Patente;
  readonly lat: number;
  readonly lng: number;
  readonly precisionMetros?: number | undefined;
  /** Cuadra elegida por el agente: prevalece sobre la detectada por GPS. */
  readonly cuadraId?: string | undefined;
}

/** Resultados con los que el vehículo puede permanecer estacionado. */
const HABILITANTES: ReadonlySet<ResultadoDeControl> = new Set(['habilitado', 'fuera_de_horario']);

/** Un control de la misma patente dentro de esta ventana se informa al agente. */
const VENTANA_DE_CONTROL_ANTERIOR_MS = 3 * 60 * 60_000;

@Injectable()
export class ControlService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly zonas: ZonasService,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Verifica una patente donde está el agente y deja registro del control.
   * La decisión es de `evaluarControl` (dominio); acá se reúnen los datos.
   */
  async controlar(
    agenteId: string,
    slugMunicipio: string,
    solicitud: SolicitudDeControl,
  ): Promise<Control> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);

    const cercanas = await this.zonas.cuadrasCerca(municipio, solicitud, RADIO_DE_CONTROL_METROS);
    const cuadraId = solicitud.cuadraId ?? cercanas[0]?.id;
    const cuadra = cuadraId ? await this.zonas.cuadraPorId(municipio, cuadraId) : null;
    const zona = cuadra?.zona ?? null;
    if (cuadra && !cercanas.some((c) => c.id === cuadra.id)) {
      // Cuadra elegida a mano lejos del GPS: cuenta como la del agente.
      cercanas.unshift({ id: cuadra.id, zonaId: cuadra.zona.id, distanciaMetros: Number.NaN });
    }

    const [ultimo, anterior] = await Promise.all([
      this.ultimoDeLaJornada(municipio, solicitud.patente, ahora),
      this.controlAnterior(municipio, solicitud.patente, ahora),
    ]);
    const resultado = evaluarControl({
      zonaId: zona?.id ?? null,
      enHorarioDeCobro: zona ? estaEnHorarioDeCobro(zona.regla, ahora) : false,
      cercanas,
      estacionamiento: ultimo ?? null,
      ahora,
    });

    const [registro] = await this.conexion.db
      .insert(controles)
      .values({
        municipioId: municipio.id,
        agenteId,
        patente: solicitud.patente,
        zonaId: zona?.id ?? null,
        cuadraId: cuadra?.id ?? null,
        estacionamientoId: ultimo?.id ?? null,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${solicitud.lng}, ${solicitud.lat}), 4326)`,
        precisionMetros:
          solicitud.precisionMetros === undefined ? null : Math.round(solicitud.precisionMetros),
        resultado,
        creadoEn: ahora,
      })
      .returning({ id: controles.id, creadoEn: controles.creadoEn });
    if (!registro) throw new Error('No se pudo registrar el control.');

    return {
      id: registro.id,
      patente: solicitud.patente,
      resultado,
      habilitado: HABILITANTES.has(resultado),
      zona: zona && { id: zona.id, nombre: zona.nombre },
      cuadra: cuadra && {
        id: cuadra.id,
        calle: cuadra.calle,
        alturaDesde: cuadra.alturaDesde,
        alturaHasta: cuadra.alturaHasta,
      },
      estacionamiento: ultimo
        ? {
            id: ultimo.id,
            zona: { id: ultimo.zonaId, nombre: ultimo.zonaNombre },
            ubicacion: ubicacionDe(ultimo, ultimo.calle),
            inicio: ultimo.inicio.toISOString(),
            venceEn: ultimo.venceEn.toISOString(),
            estado: ultimo.venceEn <= ahora ? 'vencido' : 'vigente',
            coincidencia: coincidencia(ultimo.cuadraId, cuadra?.id ?? null, cercanas),
          }
        : null,
      controlAnterior: anterior
        ? { registradoEn: anterior.creadoEn.toISOString(), resultado: anterior.resultado }
        : null,
      registradoEn: registro.creadoEn.toISOString(),
    };
  }

  /**
   * Estacionamiento que respalda (o respaldó) a la patente hoy: el que está en
   * curso o, si el último de la jornada terminó por falta de saldo, ese. Si el
   * conductor lo finalizó, ya no cubre nada y no se devuelve.
   */
  private async ultimoDeLaJornada(municipio: Municipio, patente: Patente, ahora: Date) {
    const [fila] = await this.conexion.db
      .select({
        id: estacionamientos.id,
        zonaId: estacionamientos.zonaId,
        zonaNombre: zonas.nombre,
        inicio: estacionamientos.inicio,
        venceEn: estacionamientos.venceEn,
        estado: estacionamientos.estado,
        motivoDeCierre: estacionamientos.motivoDeCierre,
        cuadraId: estacionamientos.cuadraId,
        lado: estacionamientos.lado,
        altura: estacionamientos.altura,
        lugar: estacionamientos.lugar,
        calle: cuadras.calle,
      })
      .from(estacionamientos)
      .innerJoin(zonas, eq(zonas.id, estacionamientos.zonaId))
      .leftJoin(cuadras, eq(cuadras.id, estacionamientos.cuadraId))
      .where(
        and(
          eq(estacionamientos.municipioId, municipio.id),
          eq(estacionamientos.patente, patente),
          or(
            eq(estacionamientos.estado, 'activo'),
            gte(estacionamientos.fin, inicioDelDia(ahora, municipio.zonaHoraria)),
          ),
        ),
      )
      .orderBy(desc(estacionamientos.inicio))
      .limit(1);
    if (!fila || fila.motivoDeCierre === 'conductor') return undefined;
    return fila;
  }

  private async controlAnterior(municipio: Municipio, patente: Patente, ahora: Date) {
    const [fila] = await this.conexion.db
      .select({ creadoEn: controles.creadoEn, resultado: controles.resultado })
      .from(controles)
      .where(
        and(
          eq(controles.municipioId, municipio.id),
          eq(controles.patente, patente),
          gte(controles.creadoEn, new Date(ahora.getTime() - VENTANA_DE_CONTROL_ANTERIOR_MS)),
        ),
      )
      .orderBy(desc(controles.creadoEn))
      .limit(1);
    return fila;
  }
}
