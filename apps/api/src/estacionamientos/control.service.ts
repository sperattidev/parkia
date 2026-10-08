import { Inject, Injectable } from '@nestjs/common';
import type { Control, ResultadoDeControl } from '@parkia/contracts';
import { estaEnHorarioDeCobro, type Patente } from '@parkia/domain';
import { and, eq, sql } from 'drizzle-orm';

import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { controles, cuadras, estacionamientos, zonas } from '../db/esquema.js';
import { MunicipiosService } from '../municipios/municipios.service.js';
import { ZonasService, type Zona } from '../zonas/zonas.service.js';
import { ubicacionDe } from './ubicacion.js';

export interface SolicitudDeControl {
  readonly patente: Patente;
  readonly lat: number;
  readonly lng: number;
}

/** Resultados con los que el vehículo puede permanecer estacionado. */
const HABILITANTES: ReadonlySet<ResultadoDeControl> = new Set(['habilitado', 'fuera_de_horario']);

@Injectable()
export class ControlService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly zonas: ZonasService,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Verifica una patente en la ubicación del agente y deja registro del control.
   * Orden de evaluación: cuadra tarifada → horario de cobro → estacionamiento vigente.
   */
  async controlar(
    agenteId: string,
    slugMunicipio: string,
    solicitud: SolicitudDeControl,
  ): Promise<Control> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const posicion = await this.zonas.posicionEn(municipio, solicitud);
    const cuadra = posicion?.cuadra ?? null;
    const zona = cuadra?.zona ?? null;

    const [enCurso] = await this.conexion.db
      .select({
        id: estacionamientos.id,
        zonaId: estacionamientos.zonaId,
        zonaNombre: zonas.nombre,
        inicio: estacionamientos.inicio,
        venceEn: estacionamientos.venceEn,
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
          eq(estacionamientos.patente, solicitud.patente),
          eq(estacionamientos.estado, 'activo'),
        ),
      );

    const resultado = this.evaluar(zona, enCurso, ahora);
    const [registro] = await this.conexion.db
      .insert(controles)
      .values({
        municipioId: municipio.id,
        agenteId,
        patente: solicitud.patente,
        zonaId: zona?.id ?? null,
        cuadraId: cuadra?.id ?? null,
        estacionamientoId: enCurso?.id ?? null,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${solicitud.lng}, ${solicitud.lat}), 4326)`,
        resultado,
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
      estacionamiento: enCurso
        ? {
            id: enCurso.id,
            zona: { id: enCurso.zonaId, nombre: enCurso.zonaNombre },
            ubicacion: ubicacionDe(enCurso, enCurso.calle),
            inicio: enCurso.inicio.toISOString(),
            venceEn: enCurso.venceEn.toISOString(),
          }
        : null,
      registradoEn: registro.creadoEn.toISOString(),
    };
  }

  private evaluar(
    zona: Zona | null,
    enCurso: { zonaId: string; venceEn: Date } | undefined,
    ahora: Date,
  ): ResultadoDeControl {
    if (!zona) return 'fuera_de_zona';
    if (!estaEnHorarioDeCobro(zona.regla, ahora)) return 'fuera_de_horario';
    if (!enCurso) return 'sin_estacionamiento';
    if (enCurso.venceEn <= ahora) return 'vencido';
    if (enCurso.zonaId !== zona.id) return 'otra_zona';
    return 'habilitado';
  }
}
