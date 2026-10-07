import type { ZonasGeoJson } from '@parkia/contracts';
import { notFound } from 'next/navigation';

import { PantallaEstacionar } from '@/componentes/estacionar/pantalla-estacionar';
import { obtenerDeLaApi, tokenDeSesion } from '@/lib/servidor/api';
import { municipioPorSlug } from '@/lib/servidor/municipios';

export default async function Estacionar({ params }: PageProps<'/[municipio]'>) {
  const { municipio: slug } = await params;
  // Primero el municipio: un slug inválido (o un pedido como /favicon.ico) termina acá.
  const municipio = await municipioPorSlug(slug);
  if (!municipio) notFound();

  const [zonas, token] = await Promise.all([
    obtenerDeLaApi<ZonasGeoJson>(`/v1/municipios/${municipio.slug}/zonas`),
    tokenDeSesion(),
  ]);
  if (!zonas) notFound();

  return <PantallaEstacionar municipio={municipio} zonas={zonas} haySesion={Boolean(token)} />;
}
