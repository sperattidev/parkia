'use client';

import type { AltaDeMunicipio, MunicipioDePlataforma } from '@parkia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Copy, ExternalLink, KeyRound, Plus } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Boton, CampoDeTexto, EstadoVacio, Esqueleto, Etiqueta } from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';
import { pesosRedondos } from '@/lib/formato';

const CLAVE = ['plataforma', 'municipios'] as const;

/** «Venado Tuerto» → `venado-tuerto`: el identificador que va en las direcciones. */
function aSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function useMunicipios() {
  return useQuery({
    queryKey: CLAVE,
    queryFn: () => api<MunicipioDePlataforma[]>('plataforma/municipios'),
  });
}

function FormularioDeMunicipio({
  alCrear,
  alCancelar,
}: {
  alCrear: (alta: AltaDeMunicipio) => void;
  alCancelar: () => void;
}) {
  const cliente = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditado, setSlugEditado] = useState(false);
  const [provincia, setProvincia] = useState('Santa Fe');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      api<AltaDeMunicipio>('plataforma/municipios', {
        metodo: 'POST',
        cuerpo: {
          nombre: nombre.trim(),
          slug,
          provincia: provincia.trim(),
          administrador: { nombre: adminNombre.trim(), email: adminEmail.trim() },
        },
      }),
    onSuccess: async (alta) => {
      await cliente.invalidateQueries({ queryKey: CLAVE });
      alCrear(alta);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <form
      className="animate-subir space-y-5 rounded-tarjeta bg-superficie p-6 shadow-tarjeta"
      onSubmit={(evento) => {
        evento.preventDefault();
        crear.mutate();
      }}
    >
      <h2 className="text-lg font-extrabold">Nuevo municipio</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoDeTexto
          etiqueta="Nombre"
          name="nombre"
          required
          autoFocus
          value={nombre}
          onChange={(evento) => {
            setNombre(evento.target.value);
            if (!slugEditado) setSlug(aSlug(evento.target.value));
          }}
        />
        <CampoDeTexto
          etiqueta="Identificador"
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          ayuda={`app.parkia.net.ar/${slug || '…'}`}
          value={slug}
          onChange={(evento) => {
            setSlugEditado(true);
            setSlug(aSlug(evento.target.value));
          }}
        />
        <CampoDeTexto
          etiqueta="Provincia"
          name="provincia"
          required
          value={provincia}
          onChange={(evento) => {
            setProvincia(evento.target.value);
          }}
        />
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-extrabold">Primer administrador del municipio</legend>
        <CampoDeTexto
          etiqueta="Nombre y apellido"
          name="admin-nombre"
          required
          minLength={2}
          value={adminNombre}
          onChange={(evento) => {
            setAdminNombre(evento.target.value);
          }}
        />
        <CampoDeTexto
          etiqueta="Email institucional"
          name="admin-email"
          type="email"
          required
          value={adminEmail}
          onChange={(evento) => {
            setAdminEmail(evento.target.value);
          }}
        />
      </fieldset>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={crear.isPending}>
          Dar de alta
        </Boton>
      </div>
    </form>
  );
}

function AvisoDeAlta({ alta, alCerrar }: { alta: AltaDeMunicipio; alCerrar: () => void }) {
  const [copiada, setCopiada] = useState(false);
  const { persona, contrasenaTemporal } = alta.administrador;
  return (
    <section
      role="alert"
      className="animate-subir rounded-tarjeta border-2 border-marca bg-superficie p-6 shadow-flotante"
    >
      <h2 className="flex items-center gap-2 font-extrabold">
        <KeyRound className="size-5 text-marca" aria-hidden /> {alta.municipio.nombre} ya está en
        Parkia
      </h2>
      <p className="mt-1 text-sm text-tinta-suave">
        {contrasenaTemporal
          ? `Entregale a ${persona.nombre ?? persona.email} esta contraseña temporal. No se vuelve a mostrar y la tiene que cambiar al ingresar.`
          : `${persona.email} ya tenía cuenta de personal: ingresa con su contraseña.`}
      </p>
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
        </div>
      )}
      <p className="mt-4 text-sm text-tinta-suave">
        Siguiente paso: cargar sus zonas, tarifas y cuadras desde su panel.
      </p>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/gestion/${alta.municipio.slug}/zonas` as Route}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-marca px-4 text-sm font-bold text-sobre-marca"
        >
          Abrir su panel
        </Link>
        <Boton variante="secundario" onClick={alCerrar}>
          Cerrar
        </Boton>
      </div>
    </section>
  );
}

function TarjetaDeMunicipio({ municipio }: { municipio: MunicipioDePlataforma }) {
  const cliente = useQueryClient();
  const cambiar = useMutation({
    mutationFn: (activo: boolean) =>
      api<MunicipioDePlataforma>(`plataforma/municipios/${municipio.slug}`, {
        metodo: 'PATCH',
        cuerpo: { activo },
      }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: CLAVE }),
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const datos: [string, string][] = [
    ['Recaudado (30 días)', pesosRedondos(municipio.recaudado30Dias)],
    ['Estacionamientos hoy', municipio.estacionamientosHoy.toLocaleString('es-AR')],
    ['Zonas · cuadras', `${String(municipio.zonas)} · ${String(municipio.cuadras)}`],
    ['Personal', String(municipio.personal)],
  ];

  return (
    <article
      className={`rounded-tarjeta bg-superficie p-5 shadow-tarjeta ${municipio.activo ? '' : 'opacity-70'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            {municipio.nombre}
            {municipio.activo ? (
              <Etiqueta tono="exito" punto>
                En línea
              </Etiqueta>
            ) : (
              <Etiqueta>Inactivo</Etiqueta>
            )}
          </h2>
          <p className="text-sm text-tinta-suave">
            {municipio.provincia} · /{municipio.slug}
          </p>
        </div>
        <div className="flex gap-2">
          <Boton
            variante="secundario"
            tamano="chico"
            cargando={cambiar.isPending}
            onClick={() => {
              const accion = municipio.activo ? 'desactivar' : 'activar';
              if (window.confirm(`¿Seguro que querés ${accion} ${municipio.nombre}?`)) {
                cambiar.mutate(!municipio.activo);
              }
            }}
          >
            {municipio.activo ? 'Desactivar' : 'Activar'}
          </Boton>
          {municipio.activo && (
            <Link
              href={`/gestion/${municipio.slug}` as Route}
              className="inline-flex h-9 items-center gap-1.5 rounded-control bg-marca px-3.5 text-sm font-semibold text-sobre-marca"
            >
              Abrir panel <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-control bg-superficie-2 px-3 py-2.5">
            <dt className="text-xs text-tinta-tenue">{etiqueta}</dt>
            <dd className="cifras mt-0.5 font-extrabold">{valor}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function PantallaPlataforma() {
  const municipios = useMunicipios();
  const [creando, setCreando] = useState(false);
  const [alta, setAlta] = useState<AltaDeMunicipio>();

  const activos = municipios.data?.filter((m) => m.activo) ?? [];
  const recaudado = activos.reduce((total, m) => total + m.recaudado30Dias, 0);

  return (
    <main className="mx-auto w-full max-w-6xl animate-aparecer space-y-6 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">Municipios</h1>
          {municipios.data && (
            <p className="cifras mt-1 text-sm text-tinta-suave">
              {activos.length} en línea · {pesosRedondos(recaudado)} recaudados en los últimos 30
              días
            </p>
          )}
        </div>
        {!creando && (
          <Boton
            onClick={() => {
              setCreando(true);
              setAlta(undefined);
            }}
          >
            <Plus className="size-4" aria-hidden /> Nuevo municipio
          </Boton>
        )}
      </header>

      {alta && (
        <AvisoDeAlta
          alta={alta}
          alCerrar={() => {
            setAlta(undefined);
          }}
        />
      )}
      {creando && (
        <FormularioDeMunicipio
          alCrear={(nueva) => {
            setCreando(false);
            setAlta(nueva);
          }}
          alCancelar={() => {
            setCreando(false);
          }}
        />
      )}

      {!municipios.data ? (
        <Esqueleto className="h-48 rounded-tarjeta" />
      ) : municipios.data.length === 0 ? (
        <EstadoVacio Icono={Building2} titulo="Todavía no hay municipios" />
      ) : (
        <div className="space-y-4">
          {municipios.data.map((municipio) => (
            <TarjetaDeMunicipio key={municipio.slug} municipio={municipio} />
          ))}
        </div>
      )}
    </main>
  );
}
