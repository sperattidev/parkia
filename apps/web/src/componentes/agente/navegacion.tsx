'use client';

import { ClipboardList, Map, Radar, ScanLine } from 'lucide-react';

import { NavegacionInferior, NavegacionSuperior, type Seccion } from '@/componentes/navegacion';

const SECCIONES: readonly Seccion[] = [
  { sufijo: '', texto: 'Ronda', Icono: Map },
  { sufijo: '/controlar', texto: 'Controlar', Icono: ScanLine },
  { sufijo: '/radar', texto: 'Radar', Icono: Radar },
  { sufijo: '/jornada', texto: 'Jornada', Icono: ClipboardList },
];

export function NavegacionDelAgente({
  municipio,
  ubicacion,
}: {
  municipio: string;
  ubicacion: 'inferior' | 'superior';
}) {
  const props = { municipio, base: `/agente/${municipio}`, secciones: SECCIONES };
  return ubicacion === 'inferior' ? (
    <NavegacionInferior {...props} />
  ) : (
    <NavegacionSuperior {...props} />
  );
}
