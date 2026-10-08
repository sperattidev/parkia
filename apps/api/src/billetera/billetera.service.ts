import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Billetera } from '@parkia/contracts';
import { ErrorDeDominio, centavos, formatearPesos } from '@parkia/domain';
import { and, desc, eq } from 'drizzle-orm';

import { Reloj } from '../comun/reloj.js';
import type { Conexion, Transaccion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { billeteras, movimientos } from '../db/esquema.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';

export interface BilleteraBloqueada {
  readonly id: string;
  readonly usuarioId: string;
  readonly municipioId: string;
  readonly saldo: number;
}

export interface NuevoMovimiento {
  readonly tipo: 'carga' | 'consumo' | 'reintegro' | 'ajuste';
  /** Centavos con signo. */
  readonly importe: number;
  readonly referencia: string;
  readonly descripcion: string;
  readonly registradoPor?: string | undefined;
}

/** Se invoca después de confirmar una acreditación (p. ej., para extender vencimientos). */
export type ObservadorDeAcreditacion = (usuarioId: string, municipio: Municipio) => Promise<void>;

const MOVIMIENTOS_RECIENTES = 20;

@Injectable()
export class BilleteraService {
  private readonly observadores: ObservadorDeAcreditacion[] = [];

  constructor(
    @Inject(CONEXION) private readonly conexion: Conexion,
    private readonly municipios: MunicipiosService,
    private readonly reloj: Reloj,
  ) {}

  alAcreditar(observador: ObservadorDeAcreditacion): void {
    this.observadores.push(observador);
  }

  /**
   * Obtiene (o crea) la billetera y la bloquea hasta el fin de la transacción:
   * dos operaciones simultáneas sobre el mismo saldo se ejecutan en serie.
   */
  async bloquear(
    tx: Transaccion,
    usuarioId: string,
    municipioId: string,
  ): Promise<BilleteraBloqueada> {
    await tx.insert(billeteras).values({ usuarioId, municipioId }).onConflictDoNothing();
    const [billetera] = await tx
      .select({
        id: billeteras.id,
        usuarioId: billeteras.usuarioId,
        municipioId: billeteras.municipioId,
        saldo: billeteras.saldo,
      })
      .from(billeteras)
      .where(and(eq(billeteras.usuarioId, usuarioId), eq(billeteras.municipioId, municipioId)))
      .for('update');
    if (!billetera) throw new Error('No se pudo obtener la billetera.');
    return billetera;
  }

  /**
   * Registra un movimiento sobre una billetera ya bloqueada en la misma
   * transacción y devuelve el saldo resultante. Nunca deja saldo negativo.
   */
  async registrar(
    tx: Transaccion,
    billetera: BilleteraBloqueada,
    movimiento: NuevoMovimiento,
  ): Promise<number> {
    const saldoResultante = billetera.saldo + movimiento.importe;
    if (saldoResultante < 0) {
      throw new ErrorDeDominio('SALDO_INSUFICIENTE', 'El saldo no alcanza para esta operación.');
    }
    await tx
      .update(billeteras)
      .set({ saldo: saldoResultante })
      .where(eq(billeteras.id, billetera.id));
    await tx.insert(movimientos).values({
      billeteraId: billetera.id,
      tipo: movimiento.tipo,
      importe: movimiento.importe,
      saldoResultante,
      referencia: movimiento.referencia,
      descripcion: movimiento.descripcion,
      registradoPor: movimiento.registradoPor ?? null,
      // La hora del movimiento es la de la operación (el reloj de la app), como en el resto del dominio.
      creadoEn: this.reloj.ahora(),
    });
    return saldoResultante;
  }

  async consultar(usuarioId: string, slugMunicipio: string): Promise<Billetera> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const [billetera] = await this.conexion.db
      .select({ id: billeteras.id, saldo: billeteras.saldo })
      .from(billeteras)
      .where(and(eq(billeteras.usuarioId, usuarioId), eq(billeteras.municipioId, municipio.id)));

    const recientes = billetera
      ? await this.conexion.db
          .select({
            id: movimientos.id,
            tipo: movimientos.tipo,
            importe: movimientos.importe,
            saldoResultante: movimientos.saldoResultante,
            descripcion: movimientos.descripcion,
            creadoEn: movimientos.creadoEn,
          })
          .from(movimientos)
          .where(eq(movimientos.billeteraId, billetera.id))
          .orderBy(desc(movimientos.creadoEn))
          .limit(MOVIMIENTOS_RECIENTES)
      : [];

    const saldo = billetera?.saldo ?? 0;
    return {
      municipio: municipio.slug,
      saldo,
      saldoFormateado: formatearPesos(centavos(saldo)),
      movimientos: recientes.map((m) => ({ ...m, creadoEn: m.creadoEn.toISOString() })),
    };
  }

  /** Solo fuera de producción: acredita saldo sin pago real. */
  async cargaDePrueba(
    usuarioId: string,
    slugMunicipio: string,
    importe: number,
  ): Promise<Billetera> {
    const municipio = await this.municipios.porSlug(slugMunicipio);
    await this.conexion.db.transaction(async (tx) => {
      const billetera = await this.bloquear(tx, usuarioId, municipio.id);
      await this.registrar(tx, billetera, {
        tipo: 'carga',
        importe,
        referencia: `prueba:${randomUUID()}`,
        descripcion: 'Carga de prueba',
      });
    });
    await this.notificarAcreditacion(usuarioId, municipio);
    return this.consultar(usuarioId, slugMunicipio);
  }

  private async notificarAcreditacion(usuarioId: string, municipio: Municipio): Promise<void> {
    for (const observador of this.observadores) await observador(usuarioId, municipio);
  }
}
