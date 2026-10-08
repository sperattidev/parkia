import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaZonas } from '@/componentes/gestion/pantalla-zonas';

export const metadata: Metadata = { title: 'Zonas y tarifas' };

export default function Zonas() {
  return (
    <Suspense>
      <PantallaZonas />
    </Suspense>
  );
}
