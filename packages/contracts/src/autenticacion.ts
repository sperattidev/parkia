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
    administradorDeParkia: z
      .boolean()
      .meta({ description: 'Equipo de Parkia: acceso a todos los municipios' }),
    debeCambiarContrasena: z.boolean().meta({
      description: 'Tiene una contraseña temporal: debe cambiarla antes de seguir',
    }),
  })
  .meta({ id: 'Usuario' });

/** Mínimo para contraseñas del personal: largas antes que complicadas. */
export const contrasenaNuevaSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(200, 'La contraseña no puede superar los 200 caracteres');

export const cambioDeContrasenaSchema = z
  .object({ actual: z.string().min(1).max(200), nueva: contrasenaNuevaSchema })
  .refine((cambio) => cambio.actual !== cambio.nueva, {
    message: 'La contraseña nueva tiene que ser distinta de la actual',
    path: ['nueva'],
  })
  .meta({ id: 'CambioDeContrasena' });

export type Usuario = z.infer<typeof usuarioSchema>;

export const sesionSchema = z
  .object({
    token: z.string().meta({ description: 'Enviar como `Authorization: Bearer <token>`' }),
    expiraEn: z.iso.datetime(),
    usuario: usuarioSchema,
  })
  .meta({ id: 'Sesion' });

export type Sesion = z.infer<typeof sesionSchema>;
