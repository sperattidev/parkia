import type { RolMunicipal } from '@parkia/contracts';

export interface Membresia {
  readonly municipioId: string;
  readonly municipio: string;
  readonly rol: RolMunicipal;
}

export interface UsuarioAutenticado {
  readonly id: string;
  readonly email: string;
  readonly nombre: string | null;
  readonly sesionId: string;
  readonly membresias: readonly Membresia[];
  readonly administradorDeParkia: boolean;
  readonly debeCambiarContrasena: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}
