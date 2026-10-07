import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254))
  .meta({ example: 'vecina@ejemplo.com' });

export const solicitudDeCodigoSchema = z.object({ email: emailSchema }).meta({
  id: 'SolicitudDeCodigo',
});

export const ingresoConCodigoSchema = z
  .object({
    email: emailSchema,
    codigo: z
      .string()
      .regex(/^\d{6}$/, 'El código tiene 6 dígitos')
      .meta({ example: '482913' }),
  })
  .meta({ id: 'IngresoConCodigo' });

export const ingresoConContrasenaSchema = z
  .object({ email: emailSchema, contrasena: z.string().min(1).max(200) })
  .meta({ id: 'IngresoConContrasena' });

export const rolMunicipalSchema = z.enum(['admin', 'agente', 'comercio']);
export type RolMunicipal = z.infer<typeof rolMunicipalSchema>;

export const usuarioSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    nombre: z.string().nullable(),
    membresias: z.array(z.object({ municipio: z.string(), rol: rolMunicipalSchema })),
  })
  .meta({ id: 'Usuario' });

export type Usuario = z.infer<typeof usuarioSchema>;

export const sesionSchema = z
  .object({
    token: z.string().meta({ description: 'Enviar como `Authorization: Bearer <token>`' }),
    expiraEn: z.iso.datetime(),
    usuario: usuarioSchema,
  })
  .meta({ id: 'Sesion' });

export type Sesion = z.infer<typeof sesionSchema>;
