import { Inject, Injectable } from '@nestjs/common';
import type { ResumenDeGestion } from '@parkia/contracts';
import { fechasEntre } from '@parkia/domain';
import { and, count, eq, gt, gte, inArray, lt, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import {
  billeteras,
  controles,
  cuadras,
  estacionamientos,
  movimientos,
  zonas,
} from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { resolverPeriodo, type Periodo } from './periodo.js';

const INFRACCIONES = ['sin_estacionamiento', 'vencido', 'otra_zona'] as const;

const suma = (columna: SQL | AnyColumn) => sql`coalesce(sum(${columna}), 0)`.mapWith(Number);

@Injectable()
export class ResumenService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Indicadores del período. Lo recaudado se cuenta el día en que terminó cada
   * estacionamiento (cuando se cobra); la cantidad, el día en que empezó.
   */
  async resumen(
    slugMunicipio: string,
    consulta: { desde?: string | undefined; hasta?: string | undefined },
  ): Promise<ResumenDeGestion> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const periodo = resolverPeriodo(consulta, municipio.zonaHoraria, ahora);
    const tz = municipio.zonaHoraria;

    const cobrados = and(
      eq(estacionamientos.municipioId, municipio.id),
      eq(estacionamientos.estado, 'finalizado'),
      gte(estacionamientos.fin, periodo.inicio),
      lt(estacionamientos.fin, periodo.fin),
    );
    const iniciados = and(
      eq(estacionamientos.municipioId, municipio.id),
      gte(estacionamientos.inicio, periodo.inicio),
      lt(estacionamientos.inicio, periodo.fin),
    );
    const dia = (columna: typeof estacionamientos.fin | typeof estacionamientos.inicio) =>
      sql<string>`to_char(${columna} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;

    const [[cobro], [inicio], cobroPorDia, inicioPorDia, porHora, [cargas], [control], porZona] =
      await Promise.all([
        this.conexion.db
          .select({
            recaudado: suma(estacionamientos.importe),
            minutosPromedio:
              sql`coalesce(round(avg(extract(epoch from ${estacionamientos.fin} - ${estacionamientos.inicio})) / 60), 0)`.mapWith(
                Number,
              ),
          })
          .from(estacionamientos)
          .where(cobrados),
        this.conexion.db.select({ cantidad: count() }).from(estacionamientos).where(iniciados),
        this.conexion.db
          .select({ fecha: dia(estacionamientos.fin), recaudado: suma(estacionamientos.importe) })
          .from(estacionamientos)
          .where(cobrados)
          .groupBy(sql`1`),
        this.conexion.db
          .select({ fecha: dia(estacionamientos.inicio), cantidad: count() })
          .from(estacionamientos)
          .where(iniciados)
          .groupBy(sql`1`),
        this.conexion.db
          .select({
            hora: sql`extract(hour from ${estacionamientos.inicio} AT TIME ZONE ${tz})`.mapWith(
              Number,
            ),
            cantidad: count(),
          })
          .from(estacionamientos)
          .where(iniciados)
          .groupBy(sql`1`),
        this.conexion.db
          .select({ total: suma(movimientos.importe) })
          .from(movimientos)
          .innerJoin(billeteras, eq(billeteras.id, movimientos.billeteraId))
          .where(
            and(
              eq(billeteras.municipioId, municipio.id),
              eq(movimientos.tipo, 'carga'),
              gte(movimientos.creadoEn, periodo.inicio),
              lt(movimientos.creadoEn, periodo.fin),
            ),
          ),
        this.conexion.db
          .select({
            total: count(),
            infracciones:
              sql`count(*) FILTER (WHERE ${inArray(controles.resultado, [...INFRACCIONES])})`.mapWith(
                Number,
              ),
          })
          .from(controles)
          .where(
            and(
              eq(controles.municipioId, municipio.id),
              gte(controles.creadoEn, periodo.inicio),
              lt(controles.creadoEn, periodo.fin),
            ),
          ),
        this.porZona(municipio, periodo, ahora),
      ]);

    const recaudadoDelDia = new Map(cobroPorDia.map((fila) => [fila.fecha, fila.recaudado]));
    const iniciadosDelDia = new Map(inicioPorDia.map((fila) => [fila.fecha, fila.cantidad]));
    const iniciadosDeLaHora = new Map(porHora.map((fila) => [fila.hora, fila.cantidad]));

    return {
      periodo: { desde: periodo.desde, hasta: periodo.hasta },
      recaudado: cobro?.recaudado ?? 0,
      cargas: cargas?.total ?? 0,
      estacionamientos: inicio?.cantidad ?? 0,
      minutosPromedio: cobro?.minutosPromedio ?? 0,
      controles: control?.total ?? 0,
      infracciones: control?.infracciones ?? 0,
      porDia: fechasEntre(periodo.desde, periodo.hasta).map((fecha) => ({
        fecha,
        recaudado: recaudadoDelDia.get(fecha) ?? 0,
        estacionamientos: iniciadosDelDia.get(fecha) ?? 0,
      })),
      porHora: Array.from({ length: 24 }, (_, hora) => ({
        hora,
        estacionamientos: iniciadosDeLaHora.get(hora) ?? 0,
      })),
      porZona,
      ahora: {
        activos: porZona.reduce((total, zona) => total + zona.ocupadosAhora, 0),
        capacidad: porZona.reduce((total, zona) => total + zona.capacidad, 0),
      },
    };
  }

  private async porZona(municipio: Municipio, periodo: Periodo, ahora: Date) {
    const [filasZonas, capacidad, cobro, inicio, ocupacion] = await Promise.all([
      this.conexion.db
        .select({ id: zonas.id, nombre: zonas.nombre, color: zonas.color })
        .from(zonas)
        .where(and(eq(zonas.municipioId, municipio.id), eq(zonas.activa, true)))
        .orderBy(zonas.nombre),
      this.conexion.db
        .select({
          zonaId: cuadras.zonaId,
          lugares: suma(sql`${cuadras.lugaresPar} + ${cuadras.lugaresImpar}`),
        })
        .from(cuadras)
        .where(and(eq(cuadras.municipioId, municipio.id), eq(cuadras.activa, true)))
        .groupBy(cuadras.zonaId),
      this.conexion.db
        .select({ zonaId: estacionamientos.zonaId, recaudado: suma(estacionamientos.importe) })
        .from(estacionamientos)
        .where(
          and(
            eq(estacionamientos.municipioId, municipio.id),
            eq(estacionamientos.estado, 'finalizado'),
            gte(estacionamientos.fin, periodo.inicio),
            lt(estacionamientos.fin, periodo.fin),
          ),
        )
        .groupBy(estacionamientos.zonaId),
      this.conexion.db
        .select({ zonaId: estacionamientos.zonaId, cantidad: count() })
        .from(estacionamientos)
        .where(
          and(
            eq(estacionamientos.municipioId, municipio.id),
            gte(estacionamientos.inicio, periodo.inicio),
            lt(estacionamientos.inicio, periodo.fin),
          ),
        )
        .groupBy(estacionamientos.zonaId),
      this.conexion.db
        .select({ zonaId: estacionamientos.zonaId, cantidad: count() })
        .from(estacionamientos)
        .where(
          and(
            eq(estacionamientos.municipioId, municipio.id),
            eq(estacionamientos.estado, 'activo'),
            gt(estacionamientos.venceEn, ahora),
          ),
        )
        .groupBy(estacionamientos.zonaId),
    ]);

    const por = <T extends { zonaId: string | null }>(filas: T[]) =>
      new Map(filas.map((fila) => [fila.zonaId, fila]));
    const capacidades = por(capacidad);
    const cobros = por(cobro);
    const inicios = por(inicio);
    const ocupados = por(ocupacion);
    return filasZonas.map((zona) => ({
      zona,
      recaudado: cobros.get(zona.id)?.recaudado ?? 0,
      estacionamientos: inicios.get(zona.id)?.cantidad ?? 0,
      capacidad: capacidades.get(zona.id)?.lugares ?? 0,
      ocupadosAhora: ocupados.get(zona.id)?.cantidad ?? 0,
    }));
  }
}
