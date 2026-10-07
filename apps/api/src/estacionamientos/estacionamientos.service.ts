import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { reglaTarifariaZonaSchema, type Estacionamiento } from '@parkia/contracts';
import {
  calcularVencimiento,
  centavos,
  formatearPesos,
  liquidarEstacionamiento,
  vencimientoAlIniciar,
  type Patente,
  type ReglaTarifaria,
} from '@parkia/domain';
import { and, asc, desc, eq, lte } from 'drizzle-orm';
import { z } from 'zod';

import { BilleteraService } from '../billetera/billetera.service.js';
import { ErrorDeApi, NoEncontrado } from '../comun/errores.js';
import { Reloj } from '../comun/reloj.js';
import type { Conexion, Transaccion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { esViolacionDeUnicidad } from '../db/errores-pg.js';
import { estacionamientos, vehiculos, zonas } from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { ZonasService } from '../zonas/zonas.service.js';

/** Duración máxima de un estacionamiento aunque el saldo alcance para más. */
export const DURACION_MAXIMA_MS = 7 * 24 * 60 * 60_000;
const LOTE_DE_CIERRE = 100;

type FilaEstacionamiento = typeof estacionamientos.$inferSelect;

/** La regla se guarda completa (con zona horaria) al iniciar. */
function reglaAplicada(json: unknown): ReglaTarifaria {
  const { zonaHoraria } = z.object({ zonaHoraria: z.string() }).parse(json);
  return { ...reglaTarifariaZonaSchema.parse(json), zonaHoraria };
}

const conflicto = (codigo: string, mensaje: string) =>
  new ErrorDeApi(HttpStatus.CONFLICT, codigo, mensaje);

@Injectable()
export class EstacionamientosService implements OnModuleInit {
  private readonly logger = new Logger(EstacionamientosService.name);

  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly zonas: ZonasService,
    private readonly billetera: BilleteraService,
    private readonly reloj: Reloj,
  ) {}

  onModuleInit(): void {
    // Cargar saldo durante un estacionamiento extiende su vencimiento.
    this.billetera.alAcreditar((usuarioId, municipio) =>
      this.extenderVencimiento(usuarioId, municipio),
    );
  }

  async iniciar(
    usuarioId: string,
    slugMunicipio: string,
    zonaId: string,
    patente: Patente,
  ): Promise<Estacionamiento> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const zona = await this.zonas.porId(municipio, zonaId);

    const [propio] = await this.conexion.db
      .select({ id: vehiculos.id })
      .from(vehiculos)
      .where(and(eq(vehiculos.usuarioId, usuarioId), eq(vehiculos.patente, patente)));
    if (!propio) {
      throw new ErrorDeApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VEHICULO_NO_REGISTRADO',
        `Agregá la patente ${patente} a tu cuenta antes de estacionar.`,
      );
    }

    try {
      const fila = await this.conexion.db.transaction(async (tx) => {
        const billetera = await this.billetera.bloquear(tx, usuarioId, municipio.id);
        const venceEn =
          vencimientoAlIniciar(zona.regla, ahora, centavos(billetera.saldo)) ??
          new Date(ahora.getTime() + DURACION_MAXIMA_MS);

        const [creado] = await tx
          .insert(estacionamientos)
          .values({
            municipioId: municipio.id,
            zonaId: zona.id,
            usuarioId,
            patente,
            reglaAplicada: zona.regla,
            inicio: ahora,
            venceEn: this.acotar(ahora, venceEn),
          })
          .returning();
        if (!creado) throw new Error('No se pudo crear el estacionamiento.');
        return creado;
      });
      return this.aDto(fila, municipio, zona.nombre, ahora);
    } catch (error) {
      if (esViolacionDeUnicidad(error))
        throw await this.motivoDeConflicto(usuarioId, municipio, patente);
      throw error;
    }
  }

  async finalizar(usuarioId: string, slugMunicipio: string, id: string): Promise<Estacionamiento> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const fila = await this.conexion.db.transaction(async (tx) => {
      const [actual] = await tx
        .select()
        .from(estacionamientos)
        .where(
          and(
            eq(estacionamientos.id, id),
            eq(estacionamientos.usuarioId, usuarioId),
            eq(estacionamientos.municipioId, municipio.id),
          ),
        )
        .for('update');
      if (!actual) {
        throw new NoEncontrado('ESTACIONAMIENTO_NO_ENCONTRADO', 'El estacionamiento no existe.');
      }
      // Finalizar es idempotente: repetir la operación devuelve el mismo resultado.
      if (actual.estado === 'finalizado') return actual;
      return this.cerrar(tx, actual, ahora < actual.venceEn ? ahora : actual.venceEn);
    });
    return this.aDto(fila, municipio, await this.nombreDeZona(fila.zonaId), ahora);
  }

  async activo(usuarioId: string, slugMunicipio: string): Promise<Estacionamiento | null> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const [fila] = await this.conexion.db
      .select()
      .from(estacionamientos)
      .where(
        and(
          eq(estacionamientos.usuarioId, usuarioId),
          eq(estacionamientos.municipioId, municipio.id),
          eq(estacionamientos.estado, 'activo'),
        ),
      );
    return fila ? this.aDto(fila, municipio, await this.nombreDeZona(fila.zonaId), ahora) : null;
  }

  async historial(
    usuarioId: string,
    slugMunicipio: string,
    limite = 20,
  ): Promise<Estacionamiento[]> {
    const ahora = this.reloj.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const filas = await this.conexion.db
      .select({ estacionamiento: estacionamientos, zona: zonas.nombre })
      .from(estacionamientos)
      .innerJoin(zonas, eq(zonas.id, estacionamientos.zonaId))
      .where(
        and(
          eq(estacionamientos.usuarioId, usuarioId),
          eq(estacionamientos.municipioId, municipio.id),
        ),
      )
      .orderBy(desc(estacionamientos.inicio))
      .limit(limite);
    return filas.map((f) => this.aDto(f.estacionamiento, municipio, f.zona, ahora));
  }

  /**
   * Cierra los estacionamientos cuyo saldo se agotó, cobrando hasta el
   * vencimiento. Seguro con varias instancias en paralelo (`SKIP LOCKED`).
   */
  async cerrarVencidos(): Promise<number> {
    const ahora = this.reloj.ahora();
    let cerrados = 0;
    for (;;) {
      const lote = await this.conexion.db.transaction(async (tx) => {
        const vencidos = await tx
          .select()
          .from(estacionamientos)
          .where(and(eq(estacionamientos.estado, 'activo'), lte(estacionamientos.venceEn, ahora)))
          .orderBy(asc(estacionamientos.venceEn))
          .limit(LOTE_DE_CIERRE)
          .for('update', { skipLocked: true });
        for (const vencido of vencidos) await this.cerrar(tx, vencido, vencido.venceEn);
        return vencidos.length;
      });
      cerrados += lote;
      if (lote < LOTE_DE_CIERRE) return cerrados;
    }
  }

  /** Recalcula el vencimiento del estacionamiento en curso con el saldo actual. */
  private async extenderVencimiento(usuarioId: string, municipio: Municipio): Promise<void> {
    await this.conexion.db.transaction(async (tx) => {
      const billetera = await this.billetera.bloquear(tx, usuarioId, municipio.id);
      const [actual] = await tx
        .select()
        .from(estacionamientos)
        .where(
          and(
            eq(estacionamientos.usuarioId, usuarioId),
            eq(estacionamientos.municipioId, municipio.id),
            eq(estacionamientos.estado, 'activo'),
          ),
        )
        .for('update');
      // Uno ya vencido no se reabre: el tiempo descubierto queda descubierto.
      if (!actual || actual.venceEn <= this.reloj.ahora()) return;

      // Todo el saldo respalda este estacionamiento: nada se debita hasta cerrarlo.
      const venceEn =
        calcularVencimiento(
          reglaAplicada(actual.reglaAplicada),
          actual.inicio,
          centavos(billetera.saldo),
        ) ?? new Date(actual.inicio.getTime() + DURACION_MAXIMA_MS);
      await tx
        .update(estacionamientos)
        .set({ venceEn: this.acotar(actual.inicio, venceEn) })
        .where(eq(estacionamientos.id, actual.id));
    });
  }

  /** Liquida con la regla congelada, debita la billetera y marca finalizado. */
  private async cerrar(
    tx: Transaccion,
    estacionamiento: FilaEstacionamiento,
    fin: Date,
  ): Promise<FilaEstacionamiento> {
    const { importe } = liquidarEstacionamiento(reglaAplicada(estacionamiento.reglaAplicada), {
      inicio: estacionamiento.inicio,
      fin,
    });
    const billetera = await this.billetera.bloquear(
      tx,
      estacionamiento.usuarioId,
      estacionamiento.municipioId,
    );

    // Por construcción el saldo cubre hasta el vencimiento; si no, se cobra lo disponible y se alerta.
    const cobrado = Math.min(importe, billetera.saldo);
    if (cobrado < importe) {
      this.logger.error(
        { estacionamientoId: estacionamiento.id, importe, saldo: billetera.saldo },
        'Saldo insuficiente al cerrar un estacionamiento',
      );
    }
    if (cobrado > 0) {
      await this.billetera.registrar(tx, billetera, {
        tipo: 'consumo',
        importe: -cobrado,
        referencia: `estacionamiento:${estacionamiento.id}`,
        descripcion: `Estacionamiento ${estacionamiento.patente}`,
      });
    }

    const [cerrado] = await tx
      .update(estacionamientos)
      .set({ estado: 'finalizado', fin, importe: cobrado })
      .where(eq(estacionamientos.id, estacionamiento.id))
      .returning();
    if (!cerrado) throw new Error('No se pudo cerrar el estacionamiento.');
    return cerrado;
  }

  private acotar(inicio: Date, venceEn: Date): Date {
    const maximo = inicio.getTime() + DURACION_MAXIMA_MS;
    return venceEn.getTime() > maximo ? new Date(maximo) : venceEn;
  }

  private async motivoDeConflicto(
    usuarioId: string,
    municipio: Municipio,
    patente: string,
  ): Promise<ErrorDeApi> {
    const [enCurso] = await this.conexion.db
      .select({ usuarioId: estacionamientos.usuarioId, patente: estacionamientos.patente })
      .from(estacionamientos)
      .where(
        and(
          eq(estacionamientos.municipioId, municipio.id),
          eq(estacionamientos.estado, 'activo'),
          eq(estacionamientos.usuarioId, usuarioId),
        ),
      );
    return enCurso
      ? conflicto(
          'ESTACIONAMIENTO_EN_CURSO',
          `Ya tenés un estacionamiento en curso (${enCurso.patente}). Finalizalo antes de iniciar otro.`,
        )
      : conflicto(
          'PATENTE_YA_ESTACIONADA',
          `La patente ${patente} ya tiene un estacionamiento en curso en este municipio.`,
        );
  }

  private async nombreDeZona(zonaId: string): Promise<string> {
    const [zona] = await this.conexion.db
      .select({ nombre: zonas.nombre })
      .from(zonas)
      .where(eq(zonas.id, zonaId));
    return zona?.nombre ?? '';
  }

  private aDto(
    fila: FilaEstacionamiento,
    municipio: Municipio,
    nombreZona: string,
    ahora: Date,
  ): Estacionamiento {
    const importe =
      fila.importe ??
      liquidarEstacionamiento(reglaAplicada(fila.reglaAplicada), {
        inicio: fila.inicio,
        fin: ahora < fila.venceEn ? ahora : fila.venceEn,
      }).importe;
    return {
      id: fila.id,
      municipio: municipio.slug,
      zona: { id: fila.zonaId, nombre: nombreZona },
      patente: fila.patente,
      estado: fila.estado,
      inicio: fila.inicio.toISOString(),
      venceEn: fila.venceEn.toISOString(),
      fin: fila.fin?.toISOString() ?? null,
      importe,
      importeFormateado: formatearPesos(centavos(importe)),
    };
  }
}
