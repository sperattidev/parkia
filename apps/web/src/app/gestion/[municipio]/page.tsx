import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaResumen } from '@/componentes/gestion/pantalla-resumen';

// Título absoluto: la plantilla del layout no alcanza a la página de su mismo segmento.
export const metadata: Metadata = { title: { absolute: 'Resumen · Gestión' } };

export default function Resumen() {
  return (
    <Suspense>
      <PantallaResumen />
    </Suspense>
  );
}
