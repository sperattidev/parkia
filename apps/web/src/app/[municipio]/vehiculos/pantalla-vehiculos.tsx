'use client';

import type { Vehiculo } from '@parkia/contracts';
import { esPatenteValida, normalizarPatente } from '@parkia/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CarFront, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Placa } from '@/componentes/placa';
import {
  Boton,
  CampoDeTexto,
  Esqueleto,
  EstadoVacio,
  Tarjeta,
  TituloDeSeccion,
} from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';
import { claves, useVehiculos } from '@/lib/hooks';

function FilaDeVehiculo({ vehiculo }: { vehiculo: Vehiculo }) {
  const cliente = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const quitar = useMutation({
    mutationFn: () => api(`vehiculos/${vehiculo.id}`, { metodo: 'DELETE' }),
    onSuccess: async () => {
      toast.success(`Quitaste ${vehiculo.patente}.`);
      await cliente.invalidateQueries({ queryKey: claves.vehiculos });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <li className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
      <Placa patente={vehiculo.patente} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{vehiculo.alias ?? 'Sin nombre'}</p>
      </div>
      {confirmando ? (
        <div className="flex animate-aparecer gap-1.5">
          <Boton
            variante="secundario"
            tamano="chico"
            onClick={() => {
              setConfirmando(false);
            }}
          >
            No
          </Boton>
          <Boton
            variante="peligro"
            tamano="chico"
            cargando={quitar.isPending}
            onClick={() => {
              quitar.mutate();
            }}
          >
            Quitar
          </Boton>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Quitar ${vehiculo.patente}`}
          className="grid size-10 place-items-center rounded-xl text-tinta-tenue transition hover:bg-peligro-suave hover:text-peligro"
          onClick={() => {
            setConfirmando(true);
          }}
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      )}
    </li>
  );
}

export function PantallaVehiculos() {
  const cliente = useQueryClient();
  const vehiculos = useVehiculos();
  const [patente, setPatente] = useState('');
  const [alias, setAlias] = useState('');
  const [tocado, setTocado] = useState(false);

  const valida = esPatenteValida(patente);
  const agregar = useMutation({
    mutationFn: () =>
      api<Vehiculo>('vehiculos', {
        metodo: 'POST',
        cuerpo: { patente, ...(alias.trim() && { alias: alias.trim() }) },
      }),
    onSuccess: async (vehiculo) => {
      toast.success('Vehículo agregado', {
        description: `${vehiculo.patente} ya está en tu cuenta.`,
      });
      setPatente('');
      setAlias('');
      setTocado(false);
      await cliente.invalidateQueries({ queryKey: claves.vehiculos });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <>
      <Tarjeta>
        <form
          className="space-y-5"
          onSubmit={(evento) => {
            evento.preventDefault();
            setTocado(true);
            if (valida) agregar.mutate();
          }}
        >
          <h2 className="text-lg font-extrabold">Agregar vehículo</h2>

          <div className="grid h-20 place-items-center rounded-control bg-superficie-2">
            {valida ? (
              <Placa
                patente={normalizarPatente(patente)}
                tamano="grande"
                className="animate-aparecer"
              />
            ) : (
              <span className="flex items-center gap-2 text-sm font-medium text-tinta-tenue">
                <CarFront className="size-5" aria-hidden />
                La patente aparece acá
              </span>
            )}
          </div>

          <CampoDeTexto
            etiqueta="Patente"
            name="patente"
            required
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="AB 123 CD"
            className="font-mono text-lg tracking-[0.15em] uppercase"
            value={patente}
            ayuda="Formato nuevo (AB 123 CD) o anterior (ABC 123)."
            error={
              tocado && patente.length > 0 && !valida
                ? 'No es una patente válida. Ejemplos: AB 123 CD o ABC 123.'
                : undefined
            }
            onBlur={() => {
              setTocado(true);
            }}
            onChange={(evento) => {
              setPatente(evento.target.value.toUpperCase());
            }}
          />
          <CampoDeTexto
            etiqueta="Nombre (opcional)"
            name="alias"
            maxLength={40}
            placeholder="Auto de casa"
            value={alias}
            onChange={(evento) => {
              setAlias(evento.target.value);
            }}
          />
          <Boton type="submit" tamano="grande" className="w-full" cargando={agregar.isPending}>
            <Plus className="size-5" aria-hidden /> Agregar vehículo
          </Boton>
        </form>
      </Tarjeta>

      <section>
        <TituloDeSeccion
          accion={<span className="text-xs text-tinta-tenue">Sirven en todos los municipios</span>}
        >
          Mis vehículos
        </TituloDeSeccion>
        <Tarjeta className="p-0">
          {vehiculos.isPending ? (
            <div className="space-y-3 p-5">
              <Esqueleto className="h-12 w-full" />
              <Esqueleto className="h-12 w-full" />
            </div>
          ) : vehiculos.data?.length ? (
            <ul className="divide-y divide-borde">
              {vehiculos.data.map((vehiculo) => (
                <FilaDeVehiculo key={vehiculo.id} vehiculo={vehiculo} />
              ))}
            </ul>
          ) : (
            <EstadoVacio
              Icono={CarFront}
              titulo="Todavía no agregaste vehículos"
              descripcion="Agregá la patente de tu auto o moto para poder estacionar."
            />
          )}
        </Tarjeta>
      </section>
    </>
  );
}
