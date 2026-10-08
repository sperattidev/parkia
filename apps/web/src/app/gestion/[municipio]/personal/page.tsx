import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaPersonal } from '@/componentes/gestion/pantalla-personal';

export const metadata: Metadata = { title: 'Personal' };

export default function Personal() {
  return (
    <Suspense>
      <PantallaPersonal />
    </Suspense>
  );
}
