import type { UbicacionDeEstacionamiento } from '@parkia/contracts';
import { direccion, type Lado } from '@parkia/domain';

interface DatosDeUbicacion {
  readonly cuadraId: string | null;
  readonly lado: Lado | null;
  readonly altura: number | null;
  readonly lugar: number | null;
}

/**
 * Dónde quedó el vehículo, en el formato que leen conductor y agente:
 * `Sarmiento 750 · mano par · lugar 7`. Nulo para estacionamientos anteriores a
 * la incorporación de cuadras.
 */
export function ubicacionDe(
  datos: DatosDeUbicacion,
  calle: string | null,
): UbicacionDeEstacionamiento | null {
  const { cuadraId, lado, altura, lugar } = datos;
  if (!cuadraId || !lado || altura === null || !calle) return null;
  const partes = [direccion(calle, altura), `mano ${lado}`];
  if (lugar !== null) partes.push(`lugar ${lugar}`);
  return { cuadraId, calle, altura, lado, lugar, direccion: partes.join(' · ') };
}
