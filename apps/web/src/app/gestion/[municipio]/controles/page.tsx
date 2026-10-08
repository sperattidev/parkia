import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaControles } from '@/componentes/gestion/pantalla-controles';

export const metadata: Metadata = { title: 'Controles' };

export default function Controles() {
  return (
    <Suspense>
      <PantallaControles />
    </Suspense>
  );
}
