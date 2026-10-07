import { z } from 'zod';

export const slugMunicipioSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Identificador de municipio inválido')
  .max(60)
  .meta({ example: 'firmat' });

export const municipioSchema = z
  .object({
    slug: z.string(),
    nombre: z.string(),
    provincia: z.string(),
    zonaHoraria: z.string().meta({ example: 'America/Argentina/Buenos_Aires' }),
  })
  .meta({ id: 'Municipio' });

export type MunicipioPublico = z.infer<typeof municipioSchema>;

export const ubicacionSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).meta({ example: -33.4598 }),
    lng: z.coerce.number().min(-180).max(180).meta({ example: -61.4875 }),
  })
  .meta({ id: 'Ubicacion' });

export type Ubicacion = z.infer<typeof ubicacionSchema>;

const posicionSchema = z.tuple([z.number(), z.number()]).meta({ description: '[lng, lat]' });

export const multiPoligonoSchema = z
  .object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(posicionSchema))),
  })
  .meta({ id: 'MultiPoligono', description: 'Geometría GeoJSON (WGS84)' });

export type MultiPoligono = z.infer<typeof multiPoligonoSchema>;

export const zonaResumenSchema = z
  .object({
    id: z.uuid(),
    nombre: z.string(),
    color: z.string().meta({ example: '#2563EB' }),
    enHorarioDeCobro: z.boolean(),
  })
  .meta({ id: 'ZonaResumen' });

export type ZonaResumen = z.infer<typeof zonaResumenSchema>;

export const zonasGeoJsonSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        id: z.uuid(),
        geometry: multiPoligonoSchema,
        properties: zonaResumenSchema.omit({ id: true }),
      }),
    ),
  })
  .meta({ id: 'ZonasGeoJson', description: 'Zonas del municipio como GeoJSON FeatureCollection' });

export type ZonasGeoJson = z.infer<typeof zonasGeoJsonSchema>;
