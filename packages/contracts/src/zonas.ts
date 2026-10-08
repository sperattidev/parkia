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
    lat: z.coerce.number().min(-90).max(90).meta({ example: -33.4604 }),
    lng: z.coerce.number().min(-180).max(180).meta({ example: -61.4877 }),
  })
  .meta({ id: 'Ubicacion' });

export type Ubicacion = z.infer<typeof ubicacionSchema>;

export const ladoSchema = z
  .enum(['par', 'impar'])
  .meta({ id: 'Lado', description: 'Mano de la cuadra según la numeración' });

export const zonaResumenSchema = z
  .object({
    id: z.uuid(),
    nombre: z.string(),
    color: z.string().meta({ example: '#2754E6' }),
    enHorarioDeCobro: z.boolean(),
    tarifa: z.object({
      precioHora: z.int().meta({ description: 'Centavos por hora del primer tramo' }),
      horario: z.string().meta({ example: 'Lun a Vie 8 a 20 · Sáb 8 a 13' }),
    }),
  })
  .meta({ id: 'ZonaResumen' });

export type ZonaResumen = z.infer<typeof zonaResumenSchema>;

const porLado = z.object({ par: z.int(), impar: z.int() });

export const cuadraSchema = z
  .object({
    id: z.uuid(),
    zonaId: z.uuid(),
    calle: z.string().meta({ example: 'Sarmiento' }),
    alturaDesde: z.int().meta({ example: 700 }),
    alturaHasta: z.int().meta({ example: 799 }),
    lugaresNumerados: z.boolean(),
    lugares: porLado.meta({ description: 'Capacidad estimada por mano' }),
    ocupados: porLado.meta({ description: 'Estacionamientos en curso por mano' }),
  })
  .meta({ id: 'Cuadra' });

export type Cuadra = z.infer<typeof cuadraSchema>;

const posicionSchema = z.tuple([z.number(), z.number()]).meta({ description: '[lng, lat]' });

export const lineaSchema = z
  .object({ type: z.literal('LineString'), coordinates: z.array(posicionSchema) })
  .meta({ id: 'Linea', description: 'Eje de la calle (GeoJSON, WGS84)' });

export const mapaSchema = z
  .object({
    zonas: z.array(zonaResumenSchema),
    cuadras: z.object({
      type: z.literal('FeatureCollection'),
      features: z.array(
        z.object({
          type: z.literal('Feature'),
          id: z.uuid(),
          geometry: lineaSchema,
          properties: cuadraSchema.omit({ id: true }).extend({ color: z.string() }),
        }),
      ),
    }),
  })
  .meta({ id: 'Mapa', description: 'Zonas tarifadas y sus cuadras, para dibujar el mapa' });

export type Mapa = z.infer<typeof mapaSchema>;
export type CuadraDelMapa = Mapa['cuadras']['features'][number];

export const ubicacionEnCuadraSchema = z
  .object({
    cuadra: cuadraSchema,
    zona: zonaResumenSchema,
    lado: ladoSchema,
    altura: z.int().meta({ example: 750 }),
    direccion: z.string().meta({ example: 'Sarmiento 750' }),
    distanciaMetros: z.number(),
    lugaresOcupados: z
      .array(z.int())
      .meta({ description: 'Números de lugar en uso en esa mano (cuadras con lugares numerados)' }),
  })
  .meta({ id: 'UbicacionEnCuadra' });

export type UbicacionEnCuadra = z.infer<typeof ubicacionEnCuadraSchema>;

export const lugaresDeManoSchema = z
  .object({
    cuadraId: z.uuid(),
    lado: ladoSchema,
    capacidad: z.int(),
    ocupados: z.array(z.int()).meta({ description: 'Números de lugar en uso ahora' }),
  })
  .meta({ id: 'LugaresDeMano' });

export type LugaresDeMano = z.infer<typeof lugaresDeManoSchema>;
