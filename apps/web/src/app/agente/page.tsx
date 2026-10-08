import { ShieldX } from 'lucide-react';
import type { Route } from 'next';
import { redirect } from 'next/navigation';

import { EstadoVacio } from '@/componentes/ui';
import { municipiosDeControl, usuarioActual } from '@/lib/servidor/personal';

import { BotonSalir } from './salir';

/** Entrada de la app de control: lleva al municipio del agente. */
export default async function InicioAgente() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/agente/ingresar');

  const [municipio] = municipiosDeControl(usuario);
  if (municipio) redirect(`/agente/${municipio}` as Route);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EstadoVacio
        Icono={ShieldX}
        titulo="Tu cuenta no tiene permisos de control"
        descripcion={`Ingresaste como ${usuario.email}. Pedile al municipio que te asigne el rol de agente.`}
        accion={<BotonSalir />}
      />
    </main>
  );
}
