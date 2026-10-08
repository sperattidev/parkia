import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaRonda } from '@/componentes/agente/pantalla-ronda';

// Título absoluto: la plantilla del layout no alcanza a la página de su mismo segmento.
export const metadata: Metadata = { title: { absolute: 'Ronda · Control' } };

export default function Ronda() {
  return (
    <Suspense>
      <PantallaRonda />
    </Suspense>
  );
}
