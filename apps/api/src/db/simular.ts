import { parseArgs } from 'node:util';

import { z } from 'zod';

import { validarEntorno } from '../config/entorno.js';
import { Simulador } from '../simulacion/simulador.js';
import { crearConexion } from './conexion.js';

const argumentosSchema = z.object({
  municipio: z.string().min(1).default('firmat'),
  ocupacion: z.coerce.number().min(0).max(0.9).default(0.35),
  semilla: z.coerce.number().int().nonnegative().optional(),
  limpiar: z.boolean().default(false),
});

if (import.meta.main) {
  // pnpm reenvía el separador `--` literal: se descarta para aceptar ambas formas.
  const argumentos = process.argv.slice(2);
  const { values } = parseArgs({
    args: argumentos[0] === '--' ? argumentos.slice(1) : argumentos,
    options: {
      municipio: { type: 'string' },
      ocupacion: { type: 'string' },
      semilla: { type: 'string' },
      limpiar: { type: 'boolean' },
    },
  });
  const opciones = argumentosSchema.parse(values);
  const entorno = validarEntorno(process.env);
  const conexion = crearConexion(entorno.DATABASE_URL, 1);
  try {
    // El constructor se niega a correr en producción.
    const simulador = new Simulador(conexion, entorno);
    if (opciones.limpiar) {
      const resumen = await simulador.limpiar();
      console.info(
        `Simulación limpiada: ${resumen.estacionamientos} estacionamientos, ${resumen.controles} controles y ${resumen.vehiculos} vehículos de ${resumen.conductores} conductores ficticios.`,
      );
    } else {
      const resumen = await simulador.ejecutar({ ...opciones, retroactiva: true });
      console.info(
        [
          `Actividad simulada en ${resumen.municipio} (${resumen.conductores} conductores ficticios, ${resumen.capacidad} lugares):`,
          `  iniciados ${resumen.iniciados} · retirados ${resumen.retirados} · cerrados por saldo ${resumen.cerradosPorSaldo} · omitidos ${resumen.omitidos}`,
          `  ahora: ${resumen.enCurso} en curso (${resumen.porVencer} por vencer) y ${resumen.vencidosRecientes} vencidos recientes`,
        ].join('\n'),
      );
      if (resumen.vencidosRecientes === 0) {
        console.info('  Fuera del horario de cobro no hay vencimientos: no se generan vencidos.');
      }
    }
  } finally {
    await conexion.pool.end();
  }
}
