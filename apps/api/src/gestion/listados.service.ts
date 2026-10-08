import { Inject, Injectable } from '@nestjs/common';
import type {
  EntradaDeAuditoria,
  FilaDeControl,
  FilaDeEstacionamiento,
  ListaPaginada,
  ResultadoDeControl,
} from '@parkia/contracts';
import { direccion, esPatenteValida, normalizarPatente } from '@parkia/domain';
import { and, count, desc, eq, gte, ilike, lt, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import { Reloj } from '../comun/reloj.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import {
  controles,
  cuadras,
  estacionamientos,
  registroDeAuditoria,
  usuarios,
  zonas,
} from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { fechaHoraParaCsv, generarCsv, pesosParaCsv } from './csv.js';
import { resolverPeriodo } from './periodo.js';

/** Tope de filas de una exportación: más que esto se pide por períodos más cortos. */
export const FILAS_MAXIMAS_DE_EXPORTACION = 50_000;

const HABILITANTES: readonly ResultadoDeControl[] = ['habilitado', 'fuera_de_horario'];

const MOTIVOS = {
  conductor: 'Finalizado por el conductor',
  saldo_agotado: 'Saldo agotado',
  duracion_maxima: 'Duración máxima',
} as const;

const RESULTADOS: Record<ResultadoDeControl, string> = {
  habilitado: 'Habilitado',
  fuera_de_horario: 'Fuera de horario',
  sin_estacionamiento: 'Sin estacionamiento',
  vencido: 'Vencido',
  otra_zona: 'Otra zona',
  fuera_de_zona: 'Fuera de zona',
};

export interface Pagina {
  readonly pagina: number;
  readonly porPagina: number;
}

export interface FiltroDeEstacionamientos {
  readonly desde?: string | undefined;
  readonly hasta?: string | undefined;
  readonly patente?: string | undefined;
  readonly zonaId?: string | undefined;
  readonly estado?: 'activo' | 'finalizado' | undefined;
}

export interface FiltroDeControles {
  readonly desde?: string | undefined;
  readonly hasta?: string | undefined;
  readonly patente?: string | undefined;
  readonly resultado?: ResultadoDeControl | undefined;
  readonly agenteId?: string | undefined;
}

/** Una patente completa se busca exacta; una parcial («AB12»), por prefijo. */
function porPatente(columna: AnyColumn, patente: string | undefined) {
  if (!patente) return undefined;
  if (esPatenteValida(patente)) return eq(columna, normalizarPatente(patente));
  const prefijo = patente.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return prefijo ? ilike(columna, `${prefijo}%`) : undefined;
}

@Injectable()
export class ListadosService {
  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly reloj: Reloj,
  ) {}

  // ─── Estacionamientos ──────────────────────────────────────────────────────

  async estacionamientos(
    slugMunicipio: string,
    filtro: FiltroDeEstacionamientos,
    pagina: Pagina,
  ): Promise<ListaPaginada<FilaDeEstacionamiento>> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const condicion = this.condicionDeEstacionamientos(municipio, filtro);
    const [filas, [total]] = await Promise.all([
      this.consultaDeEstacionamientos(condicion)
        .limit(pagina.porPagina)
        .offset((pagina.pagina - 1) * pagina.porPagina),
      this.conexion.db.select({ total: count() }).from(estacionamientos).where(condicion),
    ]);
    return {
      elementos: filas.map((fila) => this.aFilaDeEstacionamiento(fila)),
      total: total?.total ?? 0,
      ...pagina,
    };
  }

  async exportarEstacionamientos(
    slugMunicipio: string,
    filtro: FiltroDeEstacionamientos,
  ): Promise<string> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const filas = await this.consultaDeEstacionamientos(
      this.condicionDeEstacionamientos(municipio, filtro),
    ).limit(FILAS_MAXIMAS_DE_EXPORTACION);
    const tz = municipio.zonaHoraria;
    return generarCsv(
      [
        'Inicio',
        'Fin',
        'Patente',
        'Zona',
        'Ubicación',
        'Minutos',
        'Importe ($)',
        'Estado',
        'Cierre',
      ],
      filas.map((fila) => {
        const dto = this.aFilaDeEstacionamiento(fila);
        return [
          fechaHoraParaCsv(fila.inicio, tz),
          fechaHoraParaCsv(fila.fin, tz),
          dto.patente,
          dto.zona.nombre,
          dto.direccion,
          dto.minutos,
          pesosParaCsv(dto.importe),
          dto.estado === 'activo' ? 'En curso' : 'Finalizado',
          dto.motivoDeCierre ? MOTIVOS[dto.motivoDeCierre] : null,
        ];
      }),
    );
  }

  private condicionDeEstacionamientos(municipio: Municipio, filtro: FiltroDeEstacionamientos) {
    const periodo = resolverPeriodo(filtro, municipio.zonaHoraria, this.reloj.ahora());
    return and(
      eq(estacionamientos.municipioId, municipio.id),
      gte(estacionamientos.inicio, periodo.inicio),
      lt(estacionamientos.inicio, periodo.fin),
      porPatente(estacionamientos.patente, filtro.patente),
      filtro.zonaId ? eq(estacionamientos.zonaId, filtro.zonaId) : undefined,
      filtro.estado ? eq(estacionamientos.estado, filtro.estado) : undefined,
    );
  }

  private consultaDeEstacionamientos(condicion: SQL | undefined) {
    return this.conexion.db
      .select({
        id: estacionamientos.id,
        patente: estacionamientos.patente,
        zonaId: zonas.id,
        zonaNombre: zonas.nombre,
        zonaColor: zonas.color,
        calle: cuadras.calle,
        altura: estacionamientos.altura,
        lado: estacionamientos.lado,
        lugar: estacionamientos.lugar,
        inicio: estacionamientos.inicio,
        fin: estacionamientos.fin,
        venceEn: estacionamientos.venceEn,
        importe: estacionamientos.importe,
        estado: estacionamientos.estado,
        motivoDeCierre: estacionamientos.motivoDeCierre,
      })
      .from(estacionamientos)
      .innerJoin(zonas, eq(zonas.id, estacionamientos.zonaId))
      .leftJoin(cuadras, eq(cuadras.id, estacionamientos.cuadraId))
      .where(condicion)
      .orderBy(desc(estacionamientos.inicio));
  }

  private aFilaDeEstacionamiento(
    fila: Awaited<ReturnType<ListadosService['consultaDeEstacionamientos']>>[number],
  ): FilaDeEstacionamiento {
    const hasta = fila.fin ?? this.reloj.ahora();
    const partes =
      fila.calle && fila.altura !== null
        ? [direccion(fila.calle, fila.altura), fila.lado && `mano ${fila.lado}`]
        : [];
    if (fila.lugar !== null) partes.push(`lugar ${String(fila.lugar)}`);
    return {
      id: fila.id,
      patente: fila.patente,
      zona: { id: fila.zonaId, nombre: fila.zonaNombre, color: fila.zonaColor },
      direccion: partes.length > 0 ? partes.filter(Boolean).join(' · ') : null,
      inicio: fila.inicio.toISOString(),
      fin: fila.fin?.toISOString() ?? null,
      minutos: Math.max(Math.round((hasta.getTime() - fila.inicio.getTime()) / 60_000), 0),
      importe: fila.importe ?? 0,
      estado: fila.estado,
      motivoDeCierre: fila.motivoDeCierre,
    };
  }

  // ─── Controles ─────────────────────────────────────────────────────────────

  async controles(
    slugMunicipio: string,
    filtro: FiltroDeControles,
    pagina: Pagina,
  ): Promise<ListaPaginada<FilaDeControl>> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const condicion = this.condicionDeControles(municipio, filtro);
    const [filas, [total]] = await Promise.all([
      this.consultaDeControles(condicion)
        .limit(pagina.porPagina)
        .offset((pagina.pagina - 1) * pagina.porPagina),
      this.conexion.db.select({ total: count() }).from(controles).where(condicion),
    ]);
    return {
      elementos: filas.map((fila) => this.aFilaDeControl(fila)),
      total: total?.total ?? 0,
      ...pagina,
    };
  }

  async exportarControles(slugMunicipio: string, filtro: FiltroDeControles): Promise<string> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const filas = await this.consultaDeControles(
      this.condicionDeControles(municipio, filtro),
    ).limit(FILAS_MAXIMAS_DE_EXPORTACION);
    return generarCsv(
      ['Fecha y hora', 'Patente', 'Resultado', 'Agente', 'Calle', 'Zona', 'Precisión GPS (m)'],
      filas.map((fila) => [
        fechaHoraParaCsv(fila.creadoEn, municipio.zonaHoraria),
        fila.patente,
        RESULTADOS[fila.resultado],
        fila.agenteNombre ?? fila.agenteEmail,
        fila.calle,
        fila.zona,
        fila.precisionMetros,
      ]),
    );
  }

  private condicionDeControles(municipio: Municipio, filtro: FiltroDeControles) {
    const periodo = resolverPeriodo(filtro, municipio.zonaHoraria, this.reloj.ahora());
    return and(
      eq(controles.municipioId, municipio.id),
      gte(controles.creadoEn, periodo.inicio),
      lt(controles.creadoEn, periodo.fin),
      porPatente(controles.patente, filtro.patente),
      filtro.resultado ? eq(controles.resultado, filtro.resultado) : undefined,
      filtro.agenteId ? eq(controles.agenteId, filtro.agenteId) : undefined,
    );
  }

  private consultaDeControles(condicion: SQL | undefined) {
    return this.conexion.db
      .select({
        id: controles.id,
        patente: controles.patente,
        resultado: controles.resultado,
        agenteId: usuarios.id,
        agenteNombre: usuarios.nombre,
        agenteEmail: usuarios.email,
        calle: cuadras.calle,
        zona: zonas.nombre,
        precisionMetros: controles.precisionMetros,
        creadoEn: controles.creadoEn,
      })
      .from(controles)
      .innerJoin(usuarios, eq(usuarios.id, controles.agenteId))
      .leftJoin(cuadras, eq(cuadras.id, controles.cuadraId))
      .leftJoin(zonas, eq(zonas.id, controles.zonaId))
      .where(condicion)
      .orderBy(desc(controles.creadoEn));
  }

  private aFilaDeControl(
    fila: Awaited<ReturnType<ListadosService['consultaDeControles']>>[number],
  ): FilaDeControl {
    return {
      id: fila.id,
      patente: fila.patente,
      resultado: fila.resultado,
      habilitado: HABILITANTES.includes(fila.resultado),
      agente: { id: fila.agenteId, nombre: fila.agenteNombre ?? fila.agenteEmail },
      calle: fila.calle,
      zona: fila.zona,
      precisionMetros: fila.precisionMetros,
      registradoEn: fila.creadoEn.toISOString(),
    };
  }

  // ─── Auditoría ─────────────────────────────────────────────────────────────

  async auditoria(
    slugMunicipio: string,
    pagina: Pagina,
  ): Promise<ListaPaginada<EntradaDeAuditoria>> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const condicion = eq(registroDeAuditoria.municipioId, municipio.id);
    const [filas, [total]] = await Promise.all([
      this.conexion.db
        .select({
          id: registroDeAuditoria.id,
          accion: registroDeAuditoria.accion,
          entidad: registroDeAuditoria.entidad,
          entidadId: registroDeAuditoria.entidadId,
          email: usuarios.email,
          nombre: usuarios.nombre,
          antes: registroDeAuditoria.antes,
          despues: registroDeAuditoria.despues,
          creadoEn: registroDeAuditoria.creadoEn,
        })
        .from(registroDeAuditoria)
        .innerJoin(usuarios, eq(usuarios.id, registroDeAuditoria.usuarioId))
        .where(condicion)
        .orderBy(desc(registroDeAuditoria.creadoEn), desc(sql`${registroDeAuditoria.id}`))
        .limit(pagina.porPagina)
        .offset((pagina.pagina - 1) * pagina.porPagina),
      this.conexion.db.select({ total: count() }).from(registroDeAuditoria).where(condicion),
    ]);
    return {
      elementos: filas.map((fila) => ({
        id: fila.id,
        accion: fila.accion,
        entidad: fila.entidad,
        entidadId: fila.entidadId,
        usuario: { email: fila.email, nombre: fila.nombre },
        antes: fila.antes,
        despues: fila.despues,
        creadoEn: fila.creadoEn.toISOString(),
      })),
      total: total?.total ?? 0,
      ...pagina,
    };
  }
}
