import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ContenedorDePagina, EncabezadoDePagina } from '@/componentes/encabezado';
import { municipioPorSlug } from '@/lib/servidor/municipios';

import { PantallaHistorial } from './pantalla-historial';

export const metadata: Metadata = { title: 'Historial' };

export default async function Historial({ params }: PageProps<'/[municipio]/historial'>) {
  const municipio = await municipioPorSlug((await params).municipio);
  if (!municipio) notFound();

  return (
    <ContenedorDePagina>
      <EncabezadoDePagina titulo="Historial" subtitulo={municipio.nombre} />
      <PantallaHistorial municipio={municipio} />
    </ContenedorDePagina>
  );
}
