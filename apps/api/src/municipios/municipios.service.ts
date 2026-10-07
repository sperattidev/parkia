import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { NoEncontrado } from '../comun/errores.js';
import type { Conexion } from '../db/conexion.js';
import { CONEXION } from '../db/db.module.js';
import { municipios } from '../db/esquema.js';

export interface Municipio {
  readonly id: string;
  readonly slug: string;
  readonly nombre: string;
  readonly provincia: string;
  readonly zonaHoraria: string;
}

@Injectable()
export class MunicipiosService {
  constructor(@Inject(CONEXION) private readonly conexion: Conexion) {}

  /** Municipio activo por su identificador en la URL, o 404. */
  async porSlug(slug: string): Promise<Municipio> {
    const [municipio] = await this.conexion.db
      .select({
        id: municipios.id,
        slug: municipios.slug,
        nombre: municipios.nombre,
        provincia: municipios.provincia,
        zonaHoraria: municipios.zonaHoraria,
      })
      .from(municipios)
      .where(and(eq(municipios.slug, slug), eq(municipios.activo, true)))
      .limit(1);

    if (!municipio) {
      throw new NoEncontrado('MUNICIPIO_NO_ENCONTRADO', `No existe el municipio "${slug}".`);
    }
    return municipio;
  }
}
