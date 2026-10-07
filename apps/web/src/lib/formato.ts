export const ZONA_HORARIA_POR_DEFECTO = 'America/Argentina/Buenos_Aires';

/** Hora local del municipio, por ejemplo `10:45`. */
export function hora(iso: string, zonaHoraria = ZONA_HORARIA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: zonaHoraria,
  }).format(new Date(iso));
}

function diaLocal(fecha: Date, zonaHoraria: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(fecha);
}

/**
 * Hora con el día cuando no es hoy: `10:45`, `mañana 08:05` o `lun 12 oct 08:05`.
 * Evita que "cubierto hasta las 08:05" se lea como hoy cuando es mañana.
 */
export function horaConDia(
  iso: string,
  ahora: Date,
  zonaHoraria = ZONA_HORARIA_POR_DEFECTO,
): string {
  const fecha = new Date(iso);
  const dia = diaLocal(fecha, zonaHoraria);
  if (dia === diaLocal(ahora, zonaHoraria)) return hora(iso, zonaHoraria);
  const manana = diaLocal(new Date(ahora.getTime() + 24 * 60 * 60_000), zonaHoraria);
  if (dia === manana) return `mañana ${hora(iso, zonaHoraria)}`;
  return `${fechaCorta(iso, zonaHoraria)} ${hora(iso, zonaHoraria)}`;
}

/** Fecha corta local, por ejemplo `lun 5 oct`. */
export function fechaCorta(iso: string, zonaHoraria = ZONA_HORARIA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: zonaHoraria,
  })
    .format(new Date(iso))
    .replace(/[.,]/g, '');
}

/** Duración legible: `45 min`, `1 h 05 min`. */
export function duracion(milisegundos: number): string {
  const minutos = Math.max(0, Math.floor(milisegundos / 60_000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas} h ${String(minutos % 60).padStart(2, '0')} min`;
}

/** Pesos argentinos a partir de centavos. */
export function pesos(centavos: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
    centavos / 100,
  );
}

/** Encabezado de día para listas: `Hoy`, `Ayer` o `lunes 5 de octubre`. */
export function tituloDeDia(
  iso: string,
  ahora: Date,
  zonaHoraria = ZONA_HORARIA_POR_DEFECTO,
): string {
  const dia = diaLocal(new Date(iso), zonaHoraria);
  if (dia === diaLocal(ahora, zonaHoraria)) return 'Hoy';
  if (dia === diaLocal(new Date(ahora.getTime() - 24 * 60 * 60_000), zonaHoraria)) return 'Ayer';
  const texto = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: zonaHoraria,
  }).format(new Date(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1).replace(',', '');
}

/** Agrupa elementos por día local, conservando el orden recibido. */
export function agruparPorDia<T>(
  elementos: readonly T[],
  fecha: (elemento: T) => string,
  ahora: Date,
  zonaHoraria = ZONA_HORARIA_POR_DEFECTO,
): { titulo: string; elementos: T[] }[] {
  const grupos: { titulo: string; elementos: T[] }[] = [];
  for (const elemento of elementos) {
    const titulo = tituloDeDia(fecha(elemento), ahora, zonaHoraria);
    const ultimo = grupos.at(-1);
    if (ultimo?.titulo === titulo) ultimo.elementos.push(elemento);
    else grupos.push({ titulo, elementos: [elemento] });
  }
  return grupos;
}

/** Pesos sin centavos cuando son cero: `$ 1.000` en lugar de `$ 1.000,00`. */
export function pesosRedondos(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  }).format(centavos / 100);
}
