import type { Metadata } from 'next';

import { PantallaRadar } from '@/componentes/agente/pantalla-radar';

export const metadata: Metadata = { title: 'Radar' };

export default function Radar() {
  return <PantallaRadar />;
}
