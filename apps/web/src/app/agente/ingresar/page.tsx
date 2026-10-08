import { permanentRedirect } from 'next/navigation';

/** El ingreso del personal está unificado: se conserva esta dirección por los accesos guardados. */
export default function IngresarAgente() {
  permanentRedirect('/personal/ingresar');
}
