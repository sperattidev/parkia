import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaOcupacion } from '@/componentes/gestion/pantalla-ocupacion';

export const metadata: Metadata = { title: 'Ocupación' };

export default function Ocupacion() {
  return (
    <Suspense>
      <PantallaOcupacion />
    </Suspense>
  );
}
