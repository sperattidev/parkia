import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PantallaAuditoria } from '@/componentes/gestion/pantalla-auditoria';

export const metadata: Metadata = { title: 'Auditoría' };

export default function Auditoria() {
  return (
    <Suspense>
      <PantallaAuditoria />
    </Suspense>
  );
}
