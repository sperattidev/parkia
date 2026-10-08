import type { Metadata } from 'next';

import { PantallaJornada } from '@/componentes/agente/pantalla-jornada';

export const metadata: Metadata = { title: 'Jornada' };

export default function Jornada() {
  return <PantallaJornada />;
}
