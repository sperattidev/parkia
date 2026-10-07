'use client';

import type { Billetera, MunicipioPublico } from '@parkia/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, FlaskConical, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Boton, Cargando, Tarjeta } from '@/componentes/ui';
import { api, mensajeDeError, pedir } from '@/lib/cliente';
import { cn } from '@/lib/cn';
import { fechaCorta, hora, pesos } from '@/lib/formato';
import { claves, useBilletera } from '@/lib/hooks';

const MONTOS_DE_PRUEBA = [100_000, 200_000, 500_000];

export function PantallaSaldo({
  municipio,
  cargasDePrueba,
}: {
  municipio: MunicipioPublico;
  cargasDePrueba: boolean;
}) {
  const router = useRouter();
  const cliente = useQueryClient();
  const billetera = useBilletera(municipio.slug);

  const cargar = useMutation({
    mutationFn: (importe: number) =>
      api<Billetera>(`municipios/${municipio.slug}/billetera/cargas-de-prueba`, {
        metodo: 'POST',
        cuerpo: { importe },
      }),
    onSuccess: async (actualizada) => {
      cliente.setQueryData(claves.billetera(municipio.slug), actualizada);
      toast.success(`Saldo actualizado: ${actualizada.saldoFormateado}.`);
      // Cargar saldo extiende el vencimiento del estacionamiento en curso.
      await cliente.invalidateQueries({ queryKey: claves.activo(municipio.slug) });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const salir = useMutation({
    mutationFn: () => pedir('/api/sesion', { metodo: 'DELETE' }),
    onSuccess: () => {
      cliente.clear();
      router.replace(`/${municipio.slug}`);
      router.refresh();
    },
  });

  if (billetera.isPending) return <Cargando />;
  if (billetera.isError) return <p className="text-peligro">{mensajeDeError(billetera.error)}</p>;

  const { saldoFormateado, movimientos } = billetera.data;

  return (
    <>
      <Tarjeta className="bg-marca text-sobre-marca">
        <p className="opacity-80">Saldo disponible</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{saldoFormateado}</p>
        <p className="mt-3 text-sm opacity-80">
          Solo para estacionar en {municipio.nombre}. Se acredita en la cuenta del municipio.
        </p>
      </Tarjeta>

      <Tarjeta className="space-y-3">
        <h2 className="text-lg font-semibold">Cargar saldo</h2>
        {cargasDePrueba ? (
          <>
            <p className="flex items-center gap-2 rounded-xl bg-alerta-suave p-3 text-sm">
              <FlaskConical className="size-5 shrink-0" aria-hidden />
              Entorno de prueba: estas cargas no cobran dinero real.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {MONTOS_DE_PRUEBA.map((importe) => (
                <Boton
                  key={importe}
                  variante="secundario"
                  disabled={cargar.isPending}
                  onClick={() => {
                    cargar.mutate(importe);
                  }}
                >
                  {pesos(importe).replace(',00', '')}
                </Boton>
              ))}
            </div>
          </>
        ) : (
          <p className="text-tinta-suave">
            Muy pronto vas a poder cargar saldo con Mercado Pago y en comercios adheridos.
          </p>
        )}
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-lg font-semibold">Movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="text-tinta-suave">Todavía no hay movimientos.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {movimientos.map((movimiento) => {
              const ingreso = movimiento.importe > 0;
              return (
                <li key={movimiento.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      'grid size-9 place-items-center rounded-full',
                      ingreso ? 'bg-exito-suave text-exito' : 'bg-superficie-2 text-tinta-suave',
                    )}
                  >
                    {ingreso ? (
                      <ArrowDownLeft className="size-5" aria-hidden />
                    ) : (
                      <ArrowUpRight className="size-5" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{movimiento.descripcion}</span>
                    <span className="text-sm text-tinta-suave">
                      {fechaCorta(movimiento.creadoEn, municipio.zonaHoraria)} ·{' '}
                      {hora(movimiento.creadoEn, municipio.zonaHoraria)}
                    </span>
                  </span>
                  <span className={cn('font-semibold tabular-nums', ingreso && 'text-exito')}>
                    {ingreso ? '+' : '−'}
                    {pesos(Math.abs(movimiento.importe))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      <Boton
        variante="fantasma"
        className="w-full"
        cargando={salir.isPending}
        onClick={() => {
          salir.mutate();
        }}
      >
        <LogOut className="size-5" aria-hidden /> Cerrar sesión
      </Boton>
    </>
  );
}
