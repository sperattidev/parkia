'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

const LARGO = 6;

/**
 * Seis casillas para el código de acceso: avanza sola al escribir, retrocede
 * con borrar y acepta pegar el código completo (o autocompletarlo desde el SMS/email).
 */
export function CampoCodigo({
  valor,
  alCambiar,
  alCompletar,
  deshabilitado = false,
}: {
  valor: string;
  alCambiar: (valor: string) => void;
  alCompletar?: (valor: string) => void;
  deshabilitado?: boolean;
}) {
  const casillasRef = useRef<(HTMLInputElement | null)[]>([]);

  function fijar(nuevo: string) {
    const limpio = nuevo.replace(/\D/g, '').slice(0, LARGO);
    alCambiar(limpio);
    casillasRef.current[Math.min(limpio.length, LARGO - 1)]?.focus();
    if (limpio.length === LARGO) alCompletar?.(limpio);
  }

  function alEscribir(indice: number, texto: string) {
    const digitos = texto.replace(/\D/g, '');
    if (!digitos) return;
    // Varias cifras de una vez: autocompletado del sistema o pegado.
    if (digitos.length > 1) {
      fijar(valor.slice(0, indice) + digitos);
      return;
    }
    const caracteres = valor.padEnd(LARGO, ' ').split('');
    caracteres[indice] = digitos;
    fijar(caracteres.join('').replace(/\s/g, ''));
  }

  function alTeclear(indice: number, evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Backspace' && !valor[indice] && indice > 0) {
      evento.preventDefault();
      alCambiar(valor.slice(0, indice - 1));
      casillasRef.current[indice - 1]?.focus();
    } else if (evento.key === 'ArrowLeft' && indice > 0) {
      casillasRef.current[indice - 1]?.focus();
    } else if (evento.key === 'ArrowRight' && indice < LARGO - 1) {
      casillasRef.current[indice + 1]?.focus();
    }
  }

  function alPegar(evento: ClipboardEvent<HTMLInputElement>) {
    evento.preventDefault();
    fijar(evento.clipboardData.getData('text'));
  }

  return (
    <fieldset className="flex justify-between gap-2" aria-label="Código de 6 dígitos">
      {Array.from({ length: LARGO }, (_, indice) => (
        <input
          key={indice}
          ref={(elemento) => {
            casillasRef.current[indice] = elemento;
          }}
          value={valor[indice] ?? ''}
          disabled={deshabilitado}
          inputMode="numeric"
          autoComplete={indice === 0 ? 'one-time-code' : 'off'}
          autoFocus={indice === 0}
          maxLength={indice === 0 ? LARGO : 1}
          aria-label={`Dígito ${indice + 1}`}
          onChange={(evento) => {
            alEscribir(indice, evento.target.value);
          }}
          onKeyDown={(evento) => {
            alTeclear(indice, evento);
          }}
          onPaste={alPegar}
          onFocus={(evento) => {
            evento.target.select();
          }}
          className={cn(
            'cifras h-14 w-full min-w-0 rounded-control border-2 bg-superficie text-center text-2xl font-extrabold',
            'transition focus:border-marca focus:ring-4 focus:ring-marca/15 focus:outline-none',
            valor[indice] ? 'border-borde-fuerte' : 'border-borde',
          )}
        />
      ))}
    </fieldset>
  );
}
