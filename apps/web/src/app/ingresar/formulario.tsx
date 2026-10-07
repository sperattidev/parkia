'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { CampoCodigo } from '@/componentes/campo-codigo';
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
    mutationFn: (valor: string) =>
      pedir('/api/sesion', { metodo: 'POST', cuerpo: { email, codigo: valor } }),
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
      <Tarjeta className="animate-subir p-6 shadow-flotante sm:p-8">
        <form
          className="space-y-6"
          onSubmit={(evento) => {
            evento.preventDefault();
            enviarCodigo.mutate();
          }}
        >
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Ingresá a Parkia</h2>
            <p className="mt-1.5 text-tinta-suave">
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
          <Boton type="submit" tamano="grande" className="w-full" cargando={enviarCodigo.isPending}>
            <Mail className="size-5" aria-hidden /> Enviarme el código
          </Boton>
          <p className="text-center text-xs leading-relaxed text-tinta-tenue">
            Si es tu primera vez, la cuenta se crea sola al ingresar.
          </p>
        </form>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="animate-subir p-6 shadow-flotante sm:p-8">
      <form
        className="space-y-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          ingresar.mutate(codigo);
        }}
      >
        <div>
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-marca-suave text-marca">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight">Revisá tu email</h2>
          <p className="mt-1.5 text-tinta-suave">
            Escribí el código de 6 dígitos que enviamos a{' '}
            <strong className="text-tinta">{email}</strong>.
          </p>
        </div>
        <CampoCodigo
          valor={codigo}
          alCambiar={setCodigo}
          deshabilitado={ingresar.isPending}
          alCompletar={(valor) => {
            ingresar.mutate(valor);
          }}
        />
        <Boton
          type="submit"
          tamano="grande"
          className="w-full"
          disabled={codigo.length !== 6}
          cargando={ingresar.isPending}
        >
          Ingresar
        </Boton>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="inline-flex items-center gap-1 font-semibold text-tinta-suave hover:text-tinta"
            onClick={() => {
              setPaso('email');
              setCodigo('');
            }}
          >
            <ArrowLeft className="size-4" aria-hidden /> Cambiar email
          </button>
          <button
            type="button"
            className="font-bold text-marca disabled:opacity-50"
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
