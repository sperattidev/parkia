import { ErrorDeDominio } from '../errores.js';
import { minutosDesdeMedianoche, parsearFecha } from './calendario.js';
import type { DiaSemana, Franja, ReglaTarifaria } from './tipos.js';

const DIAS_SEMANA: readonly DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

function invalida(codigo: string, mensaje: string): never {
  throw new ErrorDeDominio(codigo, mensaje);
}

function esEnteroNoNegativo(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 0;
}

function validarZonaHoraria(zonaHoraria: string): void {
  try {
    new Intl.DateTimeFormat('es-AR', { timeZone: zonaHoraria });
  } catch {
    invalida('ZONA_HORARIA_INVALIDA', `Zona horaria desconocida: "${zonaHoraria}".`);
  }
}

/** Valida cada franja y que no se superpongan entre sí. */
function validarFranjas(franjas: readonly Franja[], contexto: string): void {
  const rangos = franjas
    .map((franja) => {
      const desde = minutosDesdeMedianoche(franja.desde);
      const hasta = minutosDesdeMedianoche(franja.hasta);
      if (desde >= hasta) {
        invalida(
          'FRANJA_INVALIDA',
          `${contexto}: la franja ${franja.desde}–${franja.hasta} debe terminar después de empezar. ` +
            'Un horario que cruza la medianoche se carga como dos franjas.',
        );
      }
      return { desde, hasta, etiqueta: `${franja.desde}–${franja.hasta}` };
    })
    .sort((a, b) => a.desde - b.desde);

  rangos.forEach((rango, i) => {
    const anterior = rangos[i - 1];
    if (anterior && anterior.hasta > rango.desde) {
      invalida(
        'FRANJAS_SUPERPUESTAS',
        `${contexto}: las franjas ${anterior.etiqueta} y ${rango.etiqueta} se superponen.`,
      );
    }
  });
}

/**
 * Verifica que una regla tarifaria sea coherente. Se ejecuta al guardar la
 * configuración y también antes de cada cálculo, para que un dato corrupto nunca
 * produzca un cobro silenciosamente incorrecto.
 */
export function validarReglaTarifaria(regla: ReglaTarifaria): void {
  validarZonaHoraria(regla.zonaHoraria);

  const { fraccionMinutos, minimoMinutos, toleranciaMinutos, tramos, topePorJornada } = regla;

  if (!esEnteroNoNegativo(fraccionMinutos) || fraccionMinutos === 0) {
    invalida('FRACCION_INVALIDA', 'La fracción de cobro debe ser un entero positivo de minutos.');
  }
  if (!esEnteroNoNegativo(minimoMinutos) || minimoMinutos % fraccionMinutos !== 0) {
    invalida(
      'MINIMO_INVALIDO',
      `El mínimo facturable debe ser un múltiplo de la fracción (${fraccionMinutos} min).`,
    );
  }
  if (!esEnteroNoNegativo(toleranciaMinutos)) {
    invalida('TOLERANCIA_INVALIDA', 'La tolerancia debe ser un entero de minutos no negativo.');
  }
  if (
    topePorJornada !== undefined &&
    (!esEnteroNoNegativo(topePorJornada) || topePorJornada === 0)
  ) {
    invalida('TOPE_INVALIDO', 'El tope por jornada debe ser un importe positivo en centavos.');
  }

  if (tramos.length === 0) {
    invalida('TRAMOS_VACIOS', 'La tarifa necesita al menos un tramo de precio.');
  }
  tramos.forEach((tramo, i) => {
    const anterior = tramos[i - 1];
    if (i === 0 && tramo.desdeMinuto !== 0) {
      invalida('TRAMOS_INVALIDOS', 'El primer tramo debe comenzar en el minuto 0.');
    }
    if (anterior && tramo.desdeMinuto <= anterior.desdeMinuto) {
      invalida(
        'TRAMOS_INVALIDOS',
        'Los tramos deben estar ordenados por minuto de inicio, sin repetir.',
      );
    }
    if (!esEnteroNoNegativo(tramo.desdeMinuto) || tramo.desdeMinuto % fraccionMinutos !== 0) {
      invalida(
        'TRAMOS_INVALIDOS',
        `Cada tramo debe comenzar en un múltiplo de la fracción (${fraccionMinutos} min).`,
      );
    }
    if (!esEnteroNoNegativo(tramo.precioHora)) {
      invalida(
        'TRAMOS_INVALIDOS',
        'El precio por hora debe ser un entero de centavos no negativo.',
      );
    }
  });

  for (const franja of regla.horario) {
    if (franja.dias.length === 0 || franja.dias.some((dia) => !DIAS_SEMANA.includes(dia))) {
      invalida(
        'DIAS_INVALIDOS',
        'Cada franja semanal necesita días entre 0 (domingo) y 6 (sábado).',
      );
    }
  }
  for (const dia of DIAS_SEMANA) {
    validarFranjas(
      regla.horario.filter((franja) => franja.dias.includes(dia)),
      `Horario del día ${dia}`,
    );
  }

  const fechasEspeciales = new Set<string>();
  for (const especial of regla.diasEspeciales ?? []) {
    parsearFecha(especial.fecha);
    if (fechasEspeciales.has(especial.fecha)) {
      invalida('DIA_ESPECIAL_DUPLICADO', `El día especial ${especial.fecha} está repetido.`);
    }
    fechasEspeciales.add(especial.fecha);
    validarFranjas(especial.franjas, `Día especial ${especial.fecha}`);
  }
}
