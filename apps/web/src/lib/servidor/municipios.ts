import 'server-only';

import type { MunicipioPublico } from '@parkia/contracts';
import { cache } from 'react';

import { obtenerDeLaApi } from './api';

/** Datos del municipio; una sola consulta por render aunque la pidan varios componentes. */
export const municipioPorSlug = cache((slug: string) =>
  /^[a-z0-9-]{2,60}$/.test(slug)
    ? obtenerDeLaApi<MunicipioPublico>(`/v1/municipios/${slug}`)
    : Promise.resolve(null),
);
