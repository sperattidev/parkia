import type { BaseDeDatos, Transaccion } from '../db/conexion.js';
import { registroDeAuditoria } from '../db/esquema.js';

export interface EntradaNueva {
  readonly municipioId: string | null;
  readonly usuarioId: string;
  /** `entidad.accion`, por ejemplo `zona.tarifa` o `personal.alta`. */
  readonly accion: string;
  readonly entidad: string;
  readonly entidadId: string;
  readonly antes?: unknown;
  readonly despues?: unknown;
}

/**
 * Deja constancia de un cambio de configuración. Se llama dentro de la misma
 * transacción que el cambio: o quedan los dos, o ninguno.
 */
export async function registrarAuditoria(
  db: BaseDeDatos | Transaccion,
  entrada: EntradaNueva,
): Promise<void> {
  await db.insert(registroDeAuditoria).values({
    municipioId: entrada.municipioId,
    usuarioId: entrada.usuarioId,
    accion: entrada.accion,
    entidad: entrada.entidad,
    entidadId: entrada.entidadId,
    antes: entrada.antes ?? null,
    despues: entrada.despues ?? null,
  });
}
