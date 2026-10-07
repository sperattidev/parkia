'use client';

import type { Vehiculo } from '@parkia/contracts';
import { esPatenteValida } from '@parkia/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Placa } from '@/componentes/placa';
import { Boton, CampoDeTexto, Cargando, Tarjeta } from '@/componentes/ui';
import { api, mensajeDeError } from '@/lib/cliente';
import { claves, useVehiculos } from '@/lib/hooks';

export function PantallaVehiculos() {
  const cliente = useQueryClient();
  const vehiculos = useVehiculos();
  const [patente, setPatente] = useState('');
  const [alias, setAlias] = useState('');
  const [tocado, setTocado] = useState(false);

  const agregar = useMutation({
    mutationFn: () =>
      api<Vehiculo>('vehiculos', {
        metodo: 'POST',
        cuerpo: { patente, ...(alias.trim() && { alias: alias.trim() }) },
      }),
    onSuccess: async (vehiculo) => {
      toast.success(`Agregaste ${vehiculo.patente}.`);
      setPatente('');
      setAlias('');
      setTocado(false);
      await cliente.invalidateQueries({ queryKey: claves.vehiculos });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const quitar = useMutation({
    mutationFn: (id: string) => api(`vehiculos/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: claves.vehiculos }),
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const patenteInvalida = tocado && patente.length > 0 && !esPatenteValida(patente);

  return (
    <>
      <Tarjeta>
        <form
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            setTocado(true);
            if (esPatenteValida(patente)) agregar.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">Agregar vehículo</h2>
          <CampoDeTexto
            etiqueta="Patente"
            name="patente"
            required
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="AB 123 CD"
            className="font-mono text-lg tracking-wider uppercase"
            value={patente}
            error={
              patenteInvalida ? 'No es una patente válida (ej.: AB 123 CD o ABC 123).' : undefined
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
          <Boton type="submit" className="w-full" cargando={agregar.isPending}>
            <Plus className="size-5" aria-hidden /> Agregar
          </Boton>
        </form>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-lg font-semibold">Mis vehículos</h2>
        {vehiculos.isPending ? (
          <Cargando />
        ) : vehiculos.data?.length ? (
          <ul className="divide-y divide-borde">
            {vehiculos.data.map((vehiculo) => (
              <li key={vehiculo.id} className="flex items-center gap-3 py-3">
                <Placa patente={vehiculo.patente} />
                <span className="flex-1 text-tinta-suave">{vehiculo.alias}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${vehiculo.patente}`}
                  disabled={quitar.isPending}
                  className="grid size-10 place-items-center rounded-xl text-tinta-suave hover:bg-peligro-suave hover:text-peligro"
                  onClick={() => {
                    quitar.mutate(vehiculo.id);
                  }}
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-tinta-suave">Todavía no agregaste ninguna patente.</p>
        )}
      </Tarjeta>
    </>
  );
}
