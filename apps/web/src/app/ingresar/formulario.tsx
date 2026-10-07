'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Mail } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Boton, CampoDeTexto, Tarjeta } from '@/componentes/ui';
import { mensajeDeError, pedir } from '@/lib/cliente';

export function FormularioDeIngreso({ volver }: { volver: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [paso, setPaso] = useState<'email' | 'codigo'>('email');

  const enviarCodigo = useMutation({
    mutationFn: () => pedir('/api/codigo', { metodo: 'POST', cuerpo: { email } }),
    onSuccess: () => {
      setPaso('codigo');
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const ingresar = useMutation({
    mutationFn: () => pedir('/api/sesion', { metodo: 'POST', cuerpo: { email, codigo } }),
    onSuccess: () => {
      router.replace(volver as Route);
      router.refresh();
    },
    onError: (error) => {
      setCodigo('');
      toast.error(mensajeDeError(error));
    },
  });

  if (paso === 'email') {
    return (
      <Tarjeta>
        <form
          className="space-y-5"
          onSubmit={(evento) => {
            evento.preventDefault();
            enviarCodigo.mutate();
          }}
        >
          <div>
            <h1 className="text-2xl font-bold">Ingresá a Parkia</h1>
            <p className="mt-1 text-tinta-suave">
              Te enviamos un código a tu email. Sin contraseñas.
            </p>
          </div>
          <CampoDeTexto
            etiqueta="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="vos@ejemplo.com"
            value={email}
            onChange={(evento) => {
              setEmail(evento.target.value);
            }}
          />
          <Boton type="submit" className="w-full" cargando={enviarCodigo.isPending}>
            <Mail className="size-5" aria-hidden /> Enviarme el código
          </Boton>
        </form>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          ingresar.mutate();
        }}
      >
        <div>
          <h1 className="text-2xl font-bold">Revisá tu email</h1>
          <p className="mt-1 text-tinta-suave">
            Escribí el código de 6 dígitos que enviamos a <strong>{email}</strong>.
          </p>
        </div>
        <CampoDeTexto
          etiqueta="Código"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="text-center font-mono text-2xl tracking-[0.5em]"
          value={codigo}
          onChange={(evento) => {
            setCodigo(evento.target.value.replace(/\D/g, ''));
          }}
        />
        <Boton
          type="submit"
          className="w-full"
          disabled={codigo.length !== 6}
          cargando={ingresar.isPending}
        >
          Ingresar
        </Boton>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-tinta-suave"
            onClick={() => {
              setPaso('email');
              setCodigo('');
            }}
          >
            <ArrowLeft className="size-4" aria-hidden /> Cambiar email
          </button>
          <button
            type="button"
            className="font-semibold text-marca disabled:opacity-50"
            disabled={enviarCodigo.isPending}
            onClick={() => {
              enviarCodigo.mutate(undefined, {
                onSuccess: () => toast.success('Te enviamos un código nuevo.'),
              });
            }}
          >
            Reenviar código
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}
