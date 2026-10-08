'use client';

import type { MunicipioPublico, Usuario } from '@parkia/contracts';
import { createContext, use, type ReactNode } from 'react';

interface Gestion {
  readonly municipio: MunicipioPublico;
  readonly usuario: Usuario;
}

const GestionContext = createContext<Gestion | null>(null);

export function ProveedorDeGestion({
  municipio,
  usuario,
  children,
}: Gestion & { children: ReactNode }) {
  return <GestionContext value={{ municipio, usuario }}>{children}</GestionContext>;
}

export function useGestion(): Gestion {
  const gestion = use(GestionContext);
  if (!gestion) throw new Error('useGestion debe usarse dentro de ProveedorDeGestion.');
  return gestion;
}
