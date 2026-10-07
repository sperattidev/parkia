import type { ZonasGeoJson } from '@parkia/contracts';
import { Clock } from 'lucide-react';

import { Etiqueta } from '@/componentes/ui';
import { pesosRedondos } from '@/lib/formato';

type Zona = ZonasGeoJson['features'][number];

/** Precio y horario de la zona: lo primero que el conductor quiere saber. */
export function TarifaDeZona({ zona }: { zona: Zona }) {
  const { tarifa } = zona.properties;
  return (
    <div className="flex items-start gap-3 rounded-control bg-superficie-2 px-4 py-3">
      <Clock className="mt-0.5 size-4 shrink-0 text-tinta-suave" aria-hidden />
      <p className="text-sm leading-snug">
        <span className="cifras font-bold">{pesosRedondos(tarifa.precioHora)}/h</span>
        <span className="text-tinta-suave"> · {tarifa.horario}</span>
      </p>
    </div>
  );
}

export function EstadoDeCobro({ zona }: { zona: Zona }) {
  return zona.properties.enHorarioDeCobro ? (
    <Etiqueta tono="marca" punto>
      Se cobra ahora
    </Etiqueta>
  ) : (
    <Etiqueta>Sin cobro ahora</Etiqueta>
  );
}
