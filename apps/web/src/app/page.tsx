import { redirect } from 'next/navigation';

/** Mientras Parkia opera en un solo municipio, la raíz lleva directo a él. */
export default function Inicio() {
  redirect('/firmat');
}
