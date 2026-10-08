import { ShieldX } from 'lucide-react';
import { redirect } from 'next/navigation';

import { BotonSalir } from '@/componentes/boton-salir';
import { EstadoVacio } from '@/componentes/ui';
import { destinoDelPersonal, usuarioActual } from '@/lib/servidor/personal';

/** Entrada del personal: lleva a su panel según el rol. */
export default async function InicioDelPersonal() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/personal/ingresar');
  const destino = destinoDelPersonal(usuario);
  if (destino) redirect(destino);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EstadoVacio
        Icono={ShieldX}
        titulo="Tu cuenta no tiene un rol asignado"
        descripcion={`Ingresaste como ${usuario.email}. Pedile al municipio que te asigne un rol.`}
        accion={<BotonSalir />}
      />
    </main>
  );
}
