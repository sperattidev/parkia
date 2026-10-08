'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { Boton } from '@/componentes/ui';
import { pedir } from '@/lib/cliente';

/** Cierra la sesión del personal y vuelve a su ingreso. */
export function BotonSalir({ compacto = false }: { compacto?: boolean }) {
  const [saliendo, setSaliendo] = useState(false);
  return (
    <Boton
      variante={compacto ? 'fantasma' : 'contorno'}
      tamano={compacto ? 'chico' : 'normal'}
      cargando={saliendo}
      onClick={() => {
        setSaliendo(true);
        void pedir('/api/sesion', { metodo: 'DELETE' })
          .catch(() => undefined)
          .then(() => {
            window.location.replace('/personal/ingresar');
          });
      }}
    >
      {!saliendo && <LogOut className="size-4" aria-hidden />}
      Salir
    </Boton>
  );
}
