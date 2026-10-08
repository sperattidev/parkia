'use client';

import type { Billetera, MunicipioPublico, Usuario } from '@parkia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, CarFront, LogOut, Plus, ReceiptText, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Isotipo } from '@/componentes/marca';
import {
  Boton,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
  TituloDeSeccion,
} from '@/componentes/ui';
import { api, mensajeDeError, pedir } from '@/lib/cliente';
import { cn } from '@/lib/cn';
import { agruparPorDia, hora, pesos, pesosRedondos } from '@/lib/formato';
import { claves, useAhora, useBilletera } from '@/lib/hooks';

const MONTOS = [100_000, 200_000, 500_000, 1_000_000];

function TarjetaDeSaldo({ municipio, saldo }: { municipio: MunicipioPublico; saldo: string }) {
  return (
    <section
      aria-label="Saldo disponible"
      className="relative overflow-hidden rounded-tarjeta bg-gradient-to-br from-[#1b3fc0] via-[#2754e6] to-[#4f7bff] p-6 text-white shadow-marca"
    >
      <div className="absolute -top-16 -right-12 size-48 rounded-full bg-white/10" aria-hidden />
      <div className="absolute -right-4 -bottom-20 size-40 rounded-full bg-white/10" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">Saldo disponible</p>
          <Isotipo className="size-8 opacity-90" />
        </div>
        <p className="cifras mt-2 text-[2.6rem] leading-none font-extrabold tracking-tight">
          {saldo}
        </p>
        <p className="mt-6 text-xs font-medium text-white/75">
          Válido para estacionar en {municipio.nombre}. Se acredita en la cuenta del municipio.
        </p>
      </div>
    </section>
  );
}

function CargarSaldo({
  municipio,
  cargasDePrueba,
}: {
  municipio: MunicipioPublico;
  cargasDePrueba: boolean;
}) {
  const cliente = useQueryClient();
  const [monto, setMonto] = useState(MONTOS[1] ?? 200_000);

  const cargar = useMutation({
    mutationFn: (importe: number) =>
      api<Billetera>(`municipios/${municipio.slug}/billetera/cargas-de-prueba`, {
        metodo: 'POST',
        cuerpo: { importe },
      }),
    onSuccess: async (actualizada) => {
      cliente.setQueryData(claves.billetera(municipio.slug), actualizada);
      toast.success('Saldo cargado', {
        description: `Nuevo saldo: ${actualizada.saldoFormateado}.`,
      });
      // Cargar saldo extiende el vencimiento del estacionamiento en curso.
      await cliente.invalidateQueries({ queryKey: claves.activo(municipio.slug) });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  if (!cargasDePrueba) {
    return (
      <Tarjeta>
        <EstadoVacio
          Icono={Plus}
          titulo="Carga de saldo, muy pronto"
          descripcion="Vas a poder cargar con Mercado Pago, tarjeta o en comercios adheridos."
        />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Cargar saldo</h2>
        <Etiqueta tono="alerta">Modo prueba</Etiqueta>
      </div>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Monto a cargar">
        {MONTOS.map((importe) => (
          <button
            key={importe}
            type="button"
            role="radio"
            aria-checked={monto === importe}
            onClick={() => {
              setMonto(importe);
            }}
            className={cn(
              'cifras h-12 rounded-control border-2 text-sm font-bold transition',
              monto === importe
                ? 'border-marca bg-marca-suave text-marca'
                : 'border-borde hover:border-borde-fuerte',
            )}
          >
            {pesosRedondos(importe)}
          </button>
        ))}
      </div>
      <Boton
        tamano="grande"
        className="w-full"
        cargando={cargar.isPending}
        onClick={() => {
          cargar.mutate(monto);
        }}
      >
        Cargar {pesosRedondos(monto)}
      </Boton>
      <p className="text-center text-xs text-tinta-tenue">
        Entorno de prueba: no se cobra dinero real.
      </p>
    </Tarjeta>
  );
}

function Movimientos({
  municipio,
  movimientos,
}: {
  municipio: MunicipioPublico;
  movimientos: Billetera['movimientos'];
}) {
  const ahora = useAhora(60_000);
  if (movimientos.length === 0) {
    return (
      <Tarjeta>
        <EstadoVacio
          Icono={ReceiptText}
          titulo="Sin movimientos todavía"
          descripcion="Acá vas a ver tus cargas y lo que pagás en cada estacionamiento."
        />
      </Tarjeta>
    );
  }
  const grupos = agruparPorDia(movimientos, (m) => m.creadoEn, ahora, municipio.zonaHoraria);
  return (
    <div className="space-y-5">
      {grupos.map((grupo) => (
        <section key={grupo.titulo}>
          <TituloDeSeccion>{grupo.titulo}</TituloDeSeccion>
          <Tarjeta className="p-0">
            <ul className="divide-y divide-borde">
              {grupo.elementos.map((movimiento) => {
                const ingreso = movimiento.importe > 0;
                return (
                  <li key={movimiento.id} className="flex items-center gap-3.5 px-5 py-3.5">
                    <span
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-xl',
                        ingreso ? 'bg-exito-suave text-exito' : 'bg-superficie-2 text-tinta-suave',
                      )}
                    >
                      {ingreso ? (
                        <ArrowDownLeft className="size-5" aria-hidden />
                      ) : (
                        <CarFront className="size-5" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem] font-semibold">
                        {movimiento.descripcion}
                      </span>
                      <span className="text-xs text-tinta-tenue">
                        {hora(movimiento.creadoEn, municipio.zonaHoraria)}
                      </span>
                    </span>
                    <span
                      className={cn('cifras text-[0.95rem] font-bold', ingreso && 'text-exito')}
                    >
                      {ingreso ? '+' : '−'}
                      {pesos(Math.abs(movimiento.importe))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        </section>
      ))}
    </div>
  );
}

function Cuenta({ municipio }: { municipio: MunicipioPublico }) {
  const cliente = useQueryClient();
  const yo = useQuery({ queryKey: ['yo'], queryFn: () => api<Usuario>('auth/yo') });
  const salir = useMutation({
    mutationFn: () => pedir('/api/sesion', { metodo: 'DELETE' }),
    onSuccess: () => {
      cliente.clear();
      // Navegación completa: ningún dato de la sesión queda en memoria del navegador.
      window.location.replace(`/${municipio.slug}`);
    },
  });

  return (
    <section>
      <TituloDeSeccion>Cuenta</TituloDeSeccion>
      <Tarjeta className="flex items-center gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marca-suave text-marca">
          <UserRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-tinta-tenue">Sesión iniciada como</p>
          {yo.data ? (
            <p className="truncate font-semibold">{yo.data.email}</p>
          ) : (
            <Esqueleto className="mt-1 h-4 w-40" />
          )}
        </div>
        <Boton
          variante="contorno"
          tamano="chico"
          cargando={salir.isPending}
          onClick={() => {
            salir.mutate();
          }}
        >
          <LogOut className="size-4" aria-hidden /> Salir
        </Boton>
      </Tarjeta>
    </section>
  );
}

export function PantallaSaldo({
  municipio,
  cargasDePrueba,
}: {
  municipio: MunicipioPublico;
  cargasDePrueba: boolean;
}) {
  const billetera = useBilletera(municipio.slug);

  if (billetera.isError) {
    return <p className="text-peligro">{mensajeDeError(billetera.error)}</p>;
  }

  return (
    <>
      {billetera.data ? (
        <TarjetaDeSaldo municipio={municipio} saldo={billetera.data.saldoFormateado} />
      ) : (
        <Esqueleto className="h-48 rounded-tarjeta" />
      )}
      <CargarSaldo municipio={municipio} cargasDePrueba={cargasDePrueba} />
      <section className="space-y-3">
        <h2 className="px-1 text-lg font-extrabold">Movimientos</h2>
        {billetera.data ? (
          <Movimientos municipio={municipio} movimientos={billetera.data.movimientos} />
        ) : (
          <Esqueleto className="h-40 rounded-tarjeta" />
        )}
      </section>
      <Cuenta municipio={municipio} />
    </>
  );
}
