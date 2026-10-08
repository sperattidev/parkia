import type { Metadata } from 'next';

import { PantallaPlataforma } from '@/componentes/plataforma/pantalla-plataforma';

export const metadata: Metadata = { title: { absolute: 'Municipios · Plataforma' } };

export default function Plataforma() {
  return <PantallaPlataforma />;
}
