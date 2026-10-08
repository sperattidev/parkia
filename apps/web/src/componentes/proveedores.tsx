'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { z } from 'zod';

import { ErrorDeParkia } from '@/lib/cliente';

// Mensajes de validación en español también en el navegador (los esquemas de @parkia/contracts).
z.config(z.locales.es());

export function Proveedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            // No reintentar errores del usuario (4xx): solo fallas de red o del servidor.
            retry: (intentos, error) =>
              intentos < 2 &&
              !(error instanceof ErrorDeParkia && error.status >= 400 && error.status < 500),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={cliente}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
