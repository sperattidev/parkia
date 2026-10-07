import type { Metadata } from 'next';

import { ContenedorDePagina, EncabezadoDePagina } from '@/componentes/encabezado';

import { PantallaVehiculos } from './pantalla-vehiculos';

export const metadata: Metadata = { title: 'Vehículos' };

export default function Vehiculos() {
  return (
    <ContenedorDePagina>
      <EncabezadoDePagina titulo="Vehículos" subtitulo="Mi cuenta" />
      <PantallaVehiculos />
    </ContenedorDePagina>
  );
}
