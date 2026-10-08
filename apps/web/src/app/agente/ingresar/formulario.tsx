'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { Boton, CampoDeTexto, Tarjeta } from '@/componentes/ui';
import { mensajeDeError, pedir } from '@/lib/cliente';

export function FormularioDePersonal() {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ingresado, setIngresado] = useState(false);

  const ingresar = useMutation({
    mutationFn: () =>
      pedir('/api/sesion/personal', { metodo: 'POST', cuerpo: { email, contrasena } }),
    onSuccess: () => {
      setIngresado(true);
      // Navegación completa: el servidor resuelve el municipio con la cookie ya guardada.
      window.location.replace('/agente');
    },
    onError: (error) => {
      setContrasena('');
      toast.error(mensajeDeError(error));
    },
  });

  return (
    <Tarjeta className="animate-subir p-6 shadow-flotante sm:p-8">
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!ingresar.isPending && !ingresado) ingresar.mutate();
        }}
      >
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Ingreso del personal</h2>
          <p className="mt-1.5 text-tinta-suave">
            Usá el email y la contraseña que te asignó el municipio.
          </p>
        </div>
        <CampoDeTexto
          etiqueta="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(evento) => {
            setEmail(evento.target.value);
          }}
        />
        <CampoDeTexto
          etiqueta="Contraseña"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          value={contrasena}
          onChange={(evento) => {
            setContrasena(evento.target.value);
          }}
        />
        <Boton
          type="submit"
          tamano="grande"
          className="w-full"
          cargando={ingresar.isPending || ingresado}
        >
          Ingresar
        </Boton>
        <p className="text-center text-xs text-tinta-tenue">
          La sesión dura una jornada. ¿Olvidaste la contraseña? Pedila a tu supervisor.
        </p>
      </form>
    </Tarjeta>
  );
}
