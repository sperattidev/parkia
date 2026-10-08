'use client';

import type { CredencialTemporal, Persona } from '@parkia/contracts';
import { Check, Copy, KeyRound, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Boton, CampoDeTexto, Esqueleto, Etiqueta } from '@/componentes/ui';
import { mensajeDeError } from '@/lib/cliente';
import { fechaCorta, hora } from '@/lib/formato';
import { useAltaDePersona, useCambiarPersona, usePersonal, useRestablecer } from '@/lib/gestion';

import { useGestion } from './contexto';
import { selectorDeFiltro } from './pantalla-estacionamientos';
import {
  ContenidoDeGestion,
  EncabezadoDeSeccion,
  MarcoDeTabla,
  celda,
  celdaDeEncabezado,
} from './piezas';

const ROLES = {
  admin: 'Administración',
  agente: 'Agente de control',
  comercio: 'Comercio',
} as const;

/** Contraseña temporal: se muestra una sola vez, para copiarla y entregarla en persona. */
function AvisoDeCredencial({
  credencial,
  alCerrar,
}: {
  credencial: CredencialTemporal;
  alCerrar: () => void;
}) {
  const [copiada, setCopiada] = useState(false);
  const { persona, contrasenaTemporal } = credencial;
  return (
    <section
      role="alert"
      className="animate-subir rounded-tarjeta border-2 border-marca bg-superficie p-5 shadow-flotante"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-extrabold">
            <KeyRound className="size-5 text-marca" aria-hidden />
            {contrasenaTemporal ? 'Contraseña temporal' : 'Acceso otorgado'}
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            {contrasenaTemporal
              ? `Entregásela a ${persona.nombre ?? persona.email} en persona o por un canal seguro. No se vuelve a mostrar: al ingresar, va a tener que elegir una propia.`
              : `${persona.email} ya tenía cuenta de personal: ingresa con su contraseña de siempre.`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={alCerrar}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-tinta-tenue hover:bg-superficie-2"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {contrasenaTemporal && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-xl bg-superficie-2 px-4 py-2.5 font-mono text-lg font-bold tracking-wider select-all">
            {contrasenaTemporal}
          </code>
          <Boton
            variante="secundario"
            onClick={() => {
              void navigator.clipboard.writeText(contrasenaTemporal).then(() => {
                setCopiada(true);
              });
            }}
          >
            {copiada ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copiada ? 'Copiada' : 'Copiar'}
          </Boton>
          <p className="w-full text-xs text-tinta-tenue">
            Ingreso: {typeof window === 'undefined' ? '' : window.location.origin}/personal/ingresar
            · usuario {persona.email}
          </p>
        </div>
      )}
    </section>
  );
}

function FormularioDeAlta({
  alCrear,
  alCancelar,
}: {
  alCrear: (credencial: CredencialTemporal) => void;
  alCancelar: () => void;
}) {
  const { municipio } = useGestion();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<'agente' | 'admin'>('agente');
  const alta = useAltaDePersona(municipio.slug);

  return (
    <form
      className="animate-subir grid gap-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(evento) => {
        evento.preventDefault();
        alta.mutate(
          { nombre: nombre.trim(), email: email.trim(), rol },
          { onSuccess: alCrear, onError: (error) => toast.error(mensajeDeError(error)) },
        );
      }}
    >
      <CampoDeTexto
        etiqueta="Nombre y apellido"
        name="nombre"
        required
        minLength={2}
        maxLength={80}
        autoFocus
        value={nombre}
        onChange={(evento) => {
          setNombre(evento.target.value);
        }}
      />
      <CampoDeTexto
        etiqueta="Email institucional"
        name="email"
        type="email"
        required
        value={email}
        onChange={(evento) => {
          setEmail(evento.target.value);
        }}
      />
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Rol</span>
        <select
          value={rol}
          onChange={(evento) => {
            setRol(evento.target.value as 'agente' | 'admin');
          }}
          className={`${selectorDeFiltro} h-13 w-full`}
        >
          <option value="agente">{ROLES.agente}</option>
          <option value="admin">{ROLES.admin}</option>
        </select>
      </label>
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={alta.isPending}>
          Dar de alta
        </Boton>
      </div>
    </form>
  );
}

function FilaDePersona({
  persona,
  esYo,
  alRestablecer,
}: {
  persona: Persona;
  esYo: boolean;
  alRestablecer: (credencial: CredencialTemporal) => void;
}) {
  const { municipio } = useGestion();
  const zh = municipio.zonaHoraria;
  const cambiar = useCambiarPersona(municipio.slug);
  const restablecer = useRestablecer(municipio.slug);
  const avisarError = (error: unknown) => toast.error(mensajeDeError(error));

  return (
    <tr className={persona.activo ? undefined : 'opacity-60'}>
      <td className={celda}>
        <p className="font-bold">
          {persona.nombre ?? '—'}
          {esYo && <span className="ml-1.5 text-xs font-semibold text-tinta-tenue">(vos)</span>}
        </p>
        <p className="text-xs text-tinta-suave">{persona.email}</p>
      </td>
      <td className={celda}>
        {persona.rol === 'comercio' ? (
          ROLES.comercio
        ) : (
          <select
            aria-label={`Rol de ${persona.email}`}
            value={persona.rol}
            disabled={!persona.activo || cambiar.isPending}
            onChange={(evento) => {
              cambiar.mutate(
                { usuarioId: persona.usuarioId, rol: evento.target.value },
                { onError: avisarError },
              );
            }}
            className={selectorDeFiltro}
          >
            <option value="agente">{ROLES.agente}</option>
            <option value="admin">{ROLES.admin}</option>
          </select>
        )}
      </td>
      <td className={celda}>
        {!persona.activo ? (
          <Etiqueta>De baja</Etiqueta>
        ) : persona.debeCambiarContrasena ? (
          <Etiqueta tono="alerta">Pendiente de ingreso</Etiqueta>
        ) : (
          <Etiqueta tono="exito">Activo</Etiqueta>
        )}
      </td>
      <td className={`${celda} cifras text-sm whitespace-nowrap text-tinta-suave`}>
        {persona.ultimoIngreso
          ? `${fechaCorta(persona.ultimoIngreso, zh)} · ${hora(persona.ultimoIngreso, zh)}`
          : 'Nunca'}
      </td>
      <td className={`${celda} cifras text-right`}>{persona.controlesHoy}</td>
      <td className={`${celda} text-right whitespace-nowrap`}>
        {!esYo && (
          <div className="flex justify-end gap-1">
            {persona.activo && (
              <Boton
                variante="fantasma"
                tamano="chico"
                cargando={restablecer.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Generar una contraseña nueva para ${persona.email}? Se le cierran todas las sesiones.`,
                    )
                  ) {
                    restablecer.mutate(persona.usuarioId, {
                      onSuccess: alRestablecer,
                      onError: avisarError,
                    });
                  }
                }}
              >
                Restablecer
              </Boton>
            )}
            <Boton
              variante="fantasma"
              tamano="chico"
              className={persona.activo ? 'text-peligro hover:bg-peligro-suave' : undefined}
              cargando={cambiar.isPending}
              onClick={() => {
                cambiar.mutate(
                  { usuarioId: persona.usuarioId, activo: !persona.activo },
                  { onError: avisarError },
                );
              }}
            >
              {persona.activo ? 'Dar de baja' : 'Reactivar'}
            </Boton>
          </div>
        )}
      </td>
    </tr>
  );
}

export function PantallaPersonal() {
  const { municipio, usuario } = useGestion();
  const personal = usePersonal(municipio.slug);
  const [agregando, setAgregando] = useState(false);
  const [credencial, setCredencial] = useState<CredencialTemporal>();

  return (
    <ContenidoDeGestion>
      <EncabezadoDeSeccion
        titulo="Personal"
        descripcion="Agentes de control y administración. Dar de baja corta el acceso en el momento y conserva su historial."
        accion={
          !agregando && (
            <Boton
              onClick={() => {
                setAgregando(true);
                setCredencial(undefined);
              }}
            >
              <UserPlus className="size-4" aria-hidden /> Agregar persona
            </Boton>
          )
        }
      />

      {credencial && (
        <AvisoDeCredencial
          credencial={credencial}
          alCerrar={() => {
            setCredencial(undefined);
          }}
        />
      )}
      {agregando && (
        <FormularioDeAlta
          alCrear={(nueva) => {
            setAgregando(false);
            setCredencial(nueva);
          }}
          alCancelar={() => {
            setAgregando(false);
          }}
        />
      )}

      {!personal.data ? (
        <Esqueleto className="h-72 rounded-tarjeta" />
      ) : (
        <MarcoDeTabla>
          <thead>
            <tr>
              <th className={celdaDeEncabezado}>Persona</th>
              <th className={celdaDeEncabezado}>Rol</th>
              <th className={celdaDeEncabezado}>Estado</th>
              <th className={celdaDeEncabezado}>Último ingreso</th>
              <th className={`${celdaDeEncabezado} text-right`}>Controles hoy</th>
              <th className={celdaDeEncabezado}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {personal.data.map((persona) => (
              <FilaDePersona
                key={persona.usuarioId}
                persona={persona}
                esYo={persona.usuarioId === usuario.id}
                alRestablecer={setCredencial}
              />
            ))}
          </tbody>
        </MarcoDeTabla>
      )}
    </ContenidoDeGestion>
  );
}
