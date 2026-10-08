import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaControlar } from '@/componentes/agente/pantalla-controlar';

export const metadata: Metadata = { title: 'Controlar' };

export default function Controlar() {
  return (
    <Suspense>
      <PantallaControlar />
    </Suspense>
  );
}
