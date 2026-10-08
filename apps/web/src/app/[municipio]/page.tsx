import type { Mapa } from '@parkia/contracts';
import { notFound } from 'next/navigation';

import { PantallaEstacionar } from '@/componentes/estacionar/pantalla-estacionar';
import { obtenerDeLaApi, tokenDeSesion } from '@/lib/servidor/api';
import { municipioPorSlug } from '@/lib/servidor/municipios';

export default async function Estacionar({ params }: PageProps<'/[municipio]'>) {
  const { municipio: slug } = await params;
  // Primero el municipio: un slug inválido (o un pedido como /favicon.ico) termina acá.
  const municipio = await municipioPorSlug(slug);
  if (!municipio) notFound();

  const [mapa, token] = await Promise.all([
    obtenerDeLaApi<Mapa>(`/v1/municipios/${municipio.slug}/mapa`),
    tokenDeSesion(),
  ]);
  if (!mapa) notFound();

  return <PantallaEstacionar municipio={municipio} mapa={mapa} haySesion={Boolean(token)} />;
}
