'use client';

import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Boton, CampoDeTexto, Tarjeta } from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';

const MINIMO = 12;

export function FormularioDeContrasena({
  email,
  obligatorio,
}: {
  email: string;
  obligatorio: boolean;
}) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [listo, setListo] = useState(false);

  const corta = nueva.length > 0 && nueva.length < MINIMO;
  const distinta = repetida.length > 0 && repetida !== nueva;

  const cambiar = useMutation({
    mutationFn: () => api('auth/contrasena', { metodo: 'POST', cuerpo: { actual, nueva } }),
    onSuccess: () => {
      setListo(true);
      toast.success('Contraseña actualizada', {
        description: 'Se cerraron tus sesiones en otros dispositivos.',
      });
      window.location.replace('/personal');
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <Tarjeta className="animate-subir p-6 shadow-flotante sm:p-8">
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!corta && !distinta && !cambiar.isPending && !listo) cambiar.mutate();
        }}
      >
        <div>
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-marca-suave text-marca">
            <KeyRound className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {obligatorio ? 'Elegí tu contraseña' : 'Cambiar contraseña'}
          </h1>
          <p className="mt-1.5 text-tinta-suave">
            {obligatorio
              ? 'Ingresaste con una contraseña temporal. Antes de seguir, elegí una propia que solo vos conozcas.'
              : `Cuenta ${email}.`}
          </p>
        </div>
        {/* El gestor de contraseñas asocia la nueva clave a esta cuenta. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <CampoDeTexto
          etiqueta={obligatorio ? 'Contraseña temporal' : 'Contraseña actual'}
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={actual}
          onChange={(evento) => {
            setActual(evento.target.value);
          }}
        />
        <CampoDeTexto
          etiqueta="Contraseña nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={MINIMO}
          ayuda={`Al menos ${String(MINIMO)} caracteres. Una frase es más segura y fácil de recordar.`}
          error={corta ? `Le faltan ${String(MINIMO - nueva.length)} caracteres.` : undefined}
          value={nueva}
          onChange={(evento) => {
            setNueva(evento.target.value);
          }}
        />
        <CampoDeTexto
          etiqueta="Repetila"
          name="repetida"
          type="password"
          autoComplete="new-password"
          required
          error={distinta ? 'No coincide con la contraseña nueva.' : undefined}
          value={repetida}
          onChange={(evento) => {
            setRepetida(evento.target.value);
          }}
        />
        <Boton
          type="submit"
          tamano="grande"
          className="w-full"
          disabled={corta || distinta || !nueva || !repetida}
          cargando={cambiar.isPending || listo}
        >
          Guardar contraseña
        </Boton>
      </form>
    </Tarjeta>
  );
}
