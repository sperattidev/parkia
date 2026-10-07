import 'server-only';

export type EntornoParkia = 'desarrollo' | 'demo' | 'produccion';

/** Mismo criterio que la API (`PARKIA_ENTORNO`): ante un valor desconocido, el más restrictivo. */
export function entornoParkia(): EntornoParkia {
  const valor = process.env.PARKIA_ENTORNO ?? 'desarrollo';
  return valor === 'desarrollo' || valor === 'demo' ? valor : 'produccion';
}

export const admiteCargasDePrueba = (): boolean => entornoParkia() !== 'produccion';
