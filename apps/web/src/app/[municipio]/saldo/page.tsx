import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ContenedorDePagina, EncabezadoDePagina } from '@/componentes/encabezado';
import { municipioPorSlug } from '@/lib/servidor/municipios';

import { PantallaSaldo } from './pantalla-saldo';

export const metadata: Metadata = { title: 'Saldo' };

export default async function Saldo({ params }: PageProps<'/[municipio]/saldo'>) {
  const municipio = await municipioPorSlug((await params).municipio);
  if (!municipio) notFound();

  return (
    <ContenedorDePagina>
      <EncabezadoDePagina titulo="Saldo" subtitulo={municipio.nombre} />
      <PantallaSaldo
        municipio={municipio}
        cargasDePrueba={process.env.PARKIA_CARGAS_DE_PRUEBA === 'true'}
      />
    </ContenedorDePagina>
  );
}
