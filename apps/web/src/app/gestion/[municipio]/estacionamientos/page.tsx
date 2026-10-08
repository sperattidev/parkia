import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaEstacionamientos } from '@/componentes/gestion/pantalla-estacionamientos';

export const metadata: Metadata = { title: 'Estacionamientos' };

export default function Estacionamientos() {
  return (
    <Suspense>
      <PantallaEstacionamientos />
    </Suspense>
  );
}
