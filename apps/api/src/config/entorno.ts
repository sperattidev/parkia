import { z } from 'zod';

const entornoSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((valor) =>
        valor
          .split(',')
          .map((origen) => origen.trim())
          .filter(Boolean),
      ),
    /** Clave para firmar (HMAC) tokens de sesión y códigos de acceso. */
    AUTH_SECRET: z.string().min(32, 'Debe tener al menos 32 caracteres'),
    CORREO_PROVEEDOR: z.enum(['consola', 'resend']).default('consola'),
    CORREO_REMITENTE: z.string().default('Parkia <no-responder@parkia.net.ar>'),
    RESEND_API_KEY: z.string().optional(),
  })
  .superRefine((entorno, ctx) => {
    if (entorno.NODE_ENV === 'production' && entorno.CORREO_PROVEEDOR === 'consola') {
      ctx.addIssue({
        code: 'custom',
        path: ['CORREO_PROVEEDOR'],
        message: 'En producción los códigos de acceso deben enviarse por email (resend)',
      });
    }
    if (entorno.CORREO_PROVEEDOR === 'resend' && !entorno.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'Es obligatoria con CORREO_PROVEEDOR=resend',
      });
    }
  });

export type Entorno = z.infer<typeof entornoSchema>;

/**
 * Valida las variables de entorno al arrancar. Si falta o sobra algo crítico,
 * la API no levanta: es preferible fallar en el deploy que en producción.
 */
export function validarEntorno(crudo: Record<string, unknown>): Entorno {
  const resultado = entornoSchema.safeParse(crudo);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detalle}`);
  }
  return resultado.data;
}
