import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Marca } from '@/componentes/marca';
import { usuarioActual } from '@/lib/servidor/personal';

import { FormularioDeContrasena } from './formulario';

export const metadata: Metadata = { title: 'Cambiar contraseña' };

export default async function CambiarContrasena() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/personal/ingresar');

  return (
    <main className="grid min-h-dvh place-items-center bg-fondo px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Marca />
        <FormularioDeContrasena email={usuario.email} obligatorio={usuario.debeCambiarContrasena} />
      </div>
    </main>
  );
}
